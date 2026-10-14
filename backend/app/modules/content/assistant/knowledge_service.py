import hashlib
import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field

from app.core.runtime_clients import get_redis_client
from app.db.mongodb import get_database
from app.modules.content.company_knowledge.service import company_knowledge_service

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "maya:knowledge:v2"
CACHE_POINTER_KEY = f"{CACHE_KEY_PREFIX}:current"
CACHE_GENERATION_KEY = f"{CACHE_KEY_PREFIX}:generation"
PROJECT_STATUSES_FOR_SALE = {"AVAILABLE", "PRE_SALE", "HANDING_OVER"}
GENERIC_TOKENS = {
    "du", "an", "project", "projects", "maian", "homes", "thong", "tin",
    "information", "cho", "toi", "biet", "about", "please", "the", "cua",
}


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", str(value or ""))
    ascii_text = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    ascii_text = ascii_text.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.casefold()).strip()


def _contains_term(value: str, term: str) -> bool:
    """Match a normalized word or phrase without accidental substring hits."""
    return f" {term.strip()} " in f" {value.strip()} "

def fallback_message(language: str, phone: str | None) -> str:
    hotline = str(phone or "").strip() or ("not currently available" if language == "en" else "chưa được cập nhật")
    if language == "en":
        return f"Mái Đỏ does not currently have verified information about this. Please contact our hotline at {hotline} for assistance."
    return f"Hiện Mái Đỏ chưa có thông tin chính xác về nội dung này. Quý khách vui lòng liên hệ hotline {hotline} để được hỗ trợ."


def unavailable_message(language: str, phone: str | None) -> str:
    hotline = str(phone or "").strip()
    if language == "en":
        message = "Mái Đỏ is temporarily unable to connect to the AI service. Please try again shortly."
        return f"{message} You can also contact our hotline at {hotline}." if hotline else message
    message = "Mái Đỏ đang tạm thời không thể kết nối với dịch vụ AI. Quý khách vui lòng thử lại sau ít phút."
    return f"{message} Quý khách cũng có thể liên hệ hotline {hotline}." if hotline else message

@dataclass
class KnowledgeResult:
    facts: list[dict] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)
    phone: str | None = None
    intent: str = "unsupported"
    partial: bool = False
    missing_topics: list[str] = field(default_factory=list)
    list_all: bool = False
    project_count: bool = False
    high_intent: bool = False
    suggested_action: dict | None = None

    @property
    def grounded(self) -> bool:
        return bool(self.facts)


async def invalidate_chat_knowledge_cache() -> None:
    try:
        redis = get_redis_client()
        await redis.incr(CACHE_GENERATION_KEY)
        await redis.delete(CACHE_POINTER_KEY)
    except Exception:
        logger.warning("maya_knowledge_cache_invalidation_failed", exc_info=True)


class ChatKnowledgeService:
    async def _load_bundle(self) -> dict:
        redis = None
        generation_before = "0"
        try:
            redis = get_redis_client()
            generation_before = str(await redis.get(CACHE_GENERATION_KEY) or "0")
            cache_key = await redis.get(CACHE_POINTER_KEY)
            if cache_key:
                cached = await redis.get(cache_key)
                if cached:
                    return json.loads(cached)
        except Exception:
            logger.warning("maya_knowledge_cache_read_failed", exc_info=True)

        database = get_database()
        projection = {
            "name": 1, "slug": 1, "status": 1, "location": 1, "developer": 1,
            "price_range": 1, "description": 1, "amenities": 1, "marketing_tags": 1,
            "seo_metadata.focus_keyword": 1, "seo_metadata.keywords": 1,
            "seo_metadata.usps": 1, "seo_metadata.key_facts": 1,
            "seo_metadata.faqs": 1, "seo_metadata.sources": 1,
            "updated_at": 1, "is_published": 1, "publication_status": 1,
        }
        projects = await database["projects"].find(
            {"is_published": True, "publication_status": {"$ne": "ARCHIVED"}},
            projection,
        ).sort("updated_at", -1).limit(200).to_list(200)
        article_projection = {
            "title": 1, "slug": 1, "category": 1, "sapo": 1, "excerpt": 1,
            "seo_metadata.focus_keyword": 1, "seo_metadata.keywords": 1,
            "seo_metadata.key_facts": 1, "seo_metadata.faqs": 1,
            "seo_metadata.sources": 1, "updated_at": 1,
        }
        articles = await database["articles"].find(
            {"status": "published", "publication_status": {"$ne": "ARCHIVED"}},
            article_projection,
        ).sort("published_at", -1).limit(100).to_list(100)
        company = await company_knowledge_service.published()
        website_settings = await database["website_settings"].find_one(
            {"_id": "global"}, {"published_snapshot": 1}
        )
        contact = dict((website_settings or {}).get("published_snapshot") or {})
        published_version = str((company or {}).get("published_version") or "none")
        bundle = {
            "company": company,
            "contact": contact,
            "published_version": published_version,
            "projects": [{**item, "_id": str(item.get("_id"))} for item in projects],
            "articles": [{**item, "_id": str(item.get("_id"))} for item in articles],
        }
        try:
            redis = redis or get_redis_client()
            generation_after = str(await redis.get(CACHE_GENERATION_KEY) or "0")
            if generation_after == generation_before:
                serialized = json.dumps(bundle, default=str, ensure_ascii=False, sort_keys=True)
                digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]
                cache_key = f"{CACHE_KEY_PREFIX}:{generation_after}:{published_version}:{digest}"
                await redis.set(cache_key, serialized, ex=300)
                await redis.set(CACHE_POINTER_KEY, cache_key, ex=300)
            else:
                logger.info("maya_knowledge_cache_write_skipped_after_invalidation")
        except Exception:
            logger.warning("maya_knowledge_cache_write_failed", exc_info=True)
        return bundle

    @staticmethod
    def _project_search_text(project: dict) -> str:
        seo = project.get("seo_metadata") or {}
        values = [
            project.get("name"), project.get("slug"), project.get("status"), project.get("location"),
            project.get("developer"), seo.get("focus_keyword"),
            *(project.get("marketing_tags") or []), *(seo.get("keywords") or []),
        ]
        return normalize_text(" ".join(str(value or "") for value in values))

    @staticmethod
    def _project_facts(project: dict) -> list[dict]:
        project_id = str(project.get("_id"))
        seo = project.get("seo_metadata") or {}
        facts = []
        fields = {
            "name": project.get("name"), "url": f"/du_an/{project.get('slug')}" if project.get("slug") else None, "status": project.get("status"),
            "location": project.get("location"), "developer": project.get("developer"),
            "price_range": project.get("price_range"), "description": project.get("description"),
            "amenities": project.get("amenities"),
        }
        source_items = [
            {"title": str(item.get("title")), "url": str(item.get("url")), "publisher": str(item.get("publisher")) if item.get("publisher") else None}
            for item in (seo.get("sources") or [])
            if isinstance(item, dict) and item.get("title") and item.get("url")
        ]
        if source_items:
            fields.update({"usps": seo.get("usps"), "key_facts": seo.get("key_facts"), "faqs": seo.get("faqs"), "sources": source_items})
        for key, value in fields.items():
            if value not in (None, "", [], {}) and not (key == "price_range" and normalize_text(str(value)) == "dang cap nhat"):
                facts.append({"id": f"project:{project_id}:{key}", "field": key, "value": value, "text": f"{key}: {value}"})
        return facts

    @staticmethod
    def _article_search_text(article: dict) -> str:
        seo = article.get("seo_metadata") or {}
        values = [
            article.get("title"), article.get("slug"), article.get("category"),
            article.get("sapo"), article.get("excerpt"),
            seo.get("focus_keyword"), *(seo.get("keywords") or []),
        ]
        return normalize_text(" ".join(str(value or "") for value in values))

    @staticmethod
    def _article_facts(article: dict) -> list[dict]:
        article_id = str(article.get("_id"))
        seo = article.get("seo_metadata") or {}
        facts = []
        fields = {
            "title": article.get("title"),
            "url": f"/tin-tuc/{article.get('slug')}" if article.get("slug") else None,
            "category": article.get("category"),
            "summary": article.get("sapo") or article.get("excerpt"),
        }
        source_items = [
            {"title": str(item.get("title")), "url": str(item.get("url")), "publisher": str(item.get("publisher")) if item.get("publisher") else None}
            for item in (seo.get("sources") or [])
            if isinstance(item, dict) and item.get("title") and item.get("url")
        ]
        if source_items:
            fields.update({"key_facts": seo.get("key_facts"), "faqs": seo.get("faqs"), "sources": source_items})
        for key, value in fields.items():
            if value not in (None, "", [], {}):
                facts.append({"id": f"article:{article_id}:{key}", "field": key, "value": value, "text": f"{key}: {value}"})
        return facts

    @staticmethod
    def _apply_high_intent(result: KnowledgeResult, normalized: str, matched_projects: list[dict] | None = None) -> None:
        high_intent_triggers = [
            (
                ("xem nha mau", "tham quan", "dat lich", "lich xem", "booking", "schedule visit", "model house"),
                "Đặt lịch xem nhà mẫu thực tế",
                "Khách muốn đặt lịch xem nhà mẫu",
            ),
            (
                ("ky gui", "dang tin ban", "nho ban", "consignment"),
                "Tư vấn ký gửi Bất động sản",
                "Khách cần tư vấn ký gửi BĐS",
            ),
            (
                ("bang gia", "gia ban", "bao gia", "chiet khau", "chinh sach thanh toan", "chinh sach gia", "price list", "pricing", "quotation", "discount"),
                "Nhận bảng giá & chính sách chiết khấu",
                "Khách quan tâm bảng giá và chính sách ưu đãi",
            ),
            (
                ("dat mua", "mua nha", "tu van mua", "thu tuc mua", "how to buy", "co hoi dau tu", "investment"),
                "Nhận tư vấn mua & đầu tư BĐS",
                "Khách quan tâm mua và đầu tư dự án",
            ),
        ]
        project_name = matched_projects[0].get("name") if matched_projects else None
        for terms, label, default_note in high_intent_triggers:
            if any(_contains_term(normalized, term) for term in terms):
                result.high_intent = True
                note = f"{default_note} ({project_name})" if project_name else default_note
                result.suggested_action = {
                    "type": "lead_capture",
                    "label": label,
                    "note": note,
                }
                break

    async def retrieve(self, query: str) -> KnowledgeResult:
        bundle = await self._load_bundle()
        normalized = normalize_text(query)
        contact = bundle.get("contact") or {}
        phone = contact.get("phone")
        result = KnowledgeResult(phone=phone)

        contact_terms = {"hotline", "phone", "telephone", "so dien thoai", "email", "thu dien tu", "zalo", "messenger", "lien he", "contact"}
        company_terms = {"maian", "company", "cong ty", "dich vu", "service", "gioi thieu", "about", "quy trinh", "policy", "chinh sach", "khu vuc", "dia ban", "gio lam viec", "thoi gian lam viec", "lich lam viec", "gio hoat dong", "thoi gian hoat dong", "mo cua", "working hours", "business hours", "opening hours", "service area"}
        project_terms = {
            "du an", "project", "can ho", "apartment", "dang ban", "for sale",
            "chu dau tu", "developer", "vi tri", "location", "gia", "price",
            "phap ly", "legal", "tien do", "progress", "loi suat", "yield",
            "chinh sach ban hang", "sales policy",
        }

        if any(_contains_term(normalized, term) for term in contact_terms):
            result.intent = "company_contact"
            for key in ("phone", "email", "zalo_url", "messenger_url"):
                if contact.get(key):
                    result.facts.append({"id": f"contact:{key}", "field": key, "value": contact[key], "text": f"{key}: {contact[key]}"})
            if result.facts:
                result.sources.append({"title": "Liên hệ Maian Homes", "url": "/lien-he", "type": "company"})
            self._apply_high_intent(result, normalized)
            return result

        company = bundle.get("company")
        projects = [
            item for item in (bundle.get("projects") or [])
            if item.get("is_published") is True
            and str(item.get("publication_status", "")) != "ARCHIVED"
            and item.get("slug")
        ]
        has_project_query = any(_contains_term(normalized, term) for term in project_terms) or any(
            normalize_text(item.get("name", "")) and _contains_term(normalized, normalize_text(item.get("name", "")))
            for item in projects
        )

        if any(_contains_term(normalized, term) for term in company_terms) and not has_project_query:
            result.intent = "company"
            if company:
                for key in ("company_name", "overview", "services", "service_areas", "working_hours", "consultation_process", "policies", "faqs", "effective_date"):
                    if company.get(key) not in (None, "", [], {}):
                        result.facts.append({"id": f"company:{key}", "field": key, "value": company[key], "text": f"{key}: {company[key]}"})
                result.sources.append({"title": "Giới thiệu Maian Homes", "url": "/gioi-thieu", "type": "company"})
            else:
                result.partial = True
                result.missing_topics.append("company_profile")
            self._apply_high_intent(result, normalized)
            return result

        if not has_project_query:
            return result
        result.intent = "projects"
        count_intent = any(
            _contains_term(normalized, term)
            for term in (
                "bao nhieu du an",
                "so luong du an",
                "co may du an",
                "how many projects",
                "number of projects",
                "project count",
            )
        )
        list_intent = (
            normalized in {"du an", "project"}
            or any(
                _contains_term(normalized, term)
                for term in (
                    "cac du an",
                    "danh sach du an",
                    "du an dang co",
                    "co du an nao",
                    "nhung du an nao",
                    "du an nao",
                    "du an gi",
                    "liet ke du an",
                    "xem du an",
                    "projects",
                    "what projects",
                    "which projects",
                    "list projects",
                    "show projects",
                )
            )
        )
        selling_intent = any(_contains_term(normalized, term) for term in ("dang ban", "for sale", "available"))
        candidates = [item for item in projects if not selling_intent or str(item.get("status")) in PROJECT_STATUSES_FOR_SALE]
        if count_intent:
            result.project_count = True
            count_field = "for_sale_count" if selling_intent else "published_count"
            result.facts.append({
                "id": f"projects:{count_field}",
                "field": count_field,
                "value": len(candidates),
                "text": f"{count_field}: {len(candidates)}",
            })
            result.sources.append({"title": "Dự án Maian Homes", "url": "/du_an", "type": "project"})
            return result
        if list_intent or selling_intent:
            matched = candidates
            result.list_all = True
            if not candidates:
                count_field = "for_sale_count" if selling_intent else "published_count"
                result.facts.append({
                    "id": f"projects:{count_field}",
                    "field": count_field,
                    "value": 0,
                    "text": f"{count_field}: 0",
                })
                result.sources.append({"title": "Dự án Maian Homes", "url": "/du_an", "type": "project"})
        else:
            query_tokens = {token for token in normalized.split() if len(token) >= 3 and token not in GENERIC_TOKENS}
            scored: list[tuple[int, dict]] = []
            for project in candidates:
                search_text = self._project_search_text(project)
                name = normalize_text(project.get("name", ""))
                score = (10 if name and _contains_term(normalized, name) else 0) + sum(1 for token in query_tokens if _contains_term(search_text, token))
                if score:
                    scored.append((score, project))
            matched = [item for _, item in sorted(scored, key=lambda value: value[0], reverse=True)[:3]]

        requested_topics = {
            "price": (("gia", "price", "cost"), ("price range", "gia")),
            "legal": (("phap ly", "legal", "so hong", "giay phep"), ("phap ly", "legal", "so hong", "giay phep")),
            "progress": (("tien do", "progress", "ban giao"), ("tien do", "progress", "ban giao", "handing over")),
            "yield": (("loi suat", "yield", "return", "profit"), ("loi suat", "yield", "return", "profit")),
            "sales_policy": (("chinh sach ban hang", "sales policy"), ("chinh sach ban hang", "sales policy")),
        }
        for project in matched:
            project_facts = self._project_facts(project)
            if list_intent or selling_intent:
                project_facts = [fact for fact in project_facts if fact["id"].rsplit(":", 1)[-1] in {"name", "url", "status"}]
            result.facts.extend(project_facts)
            result.sources.append({"title": str(project.get("name") or "Dự án Maian Homes"), "url": f"/du_an/{project.get('slug')}", "type": "project"})
            evidence_text = normalize_text(" ".join(str(fact.get("text") or "") for fact in project_facts))
            for topic, (query_terms, evidence_terms) in requested_topics.items():
                if any(_contains_term(normalized, term) for term in query_terms) and not any(_contains_term(evidence_text, term) for term in evidence_terms):
                    result.partial = True
                    missing = f"{topic}:{project.get('slug')}"
                    if missing not in result.missing_topics:
                        result.missing_topics.append(missing)

        # Article RAG search if no project facts matched or if query specifically relates to articles/news
        if not result.facts:
            articles = [
                item for item in (bundle.get("articles") or [])
                if item.get("slug")
            ]
            query_tokens = {token for token in normalized.split() if len(token) >= 3 and token not in GENERIC_TOKENS}
            article_scored: list[tuple[int, dict]] = []
            for art in articles:
                search_text = self._article_search_text(art)
                title = normalize_text(art.get("title", ""))
                score = (10 if title and _contains_term(normalized, title) else 0) + sum(1 for token in query_tokens if _contains_term(search_text, token))
                if score >= 2:
                    article_scored.append((score, art))
            matched_articles = [item for _, item in sorted(article_scored, key=lambda v: v[0], reverse=True)[:2]]
            if matched_articles:
                result.intent = "articles"
                for art in matched_articles:
                    facts = self._article_facts(art)
                    result.facts.extend(facts)
                    result.sources.append({
                        "title": str(art.get("title") or "Tin tức Maian Homes"),
                        "url": f"/tin-tuc/{art.get('slug')}",
                        "type": "article",
                    })

        self._apply_high_intent(result, normalized, matched_projects=matched if 'matched' in locals() else None)
        return result


chat_knowledge_service = ChatKnowledgeService()
