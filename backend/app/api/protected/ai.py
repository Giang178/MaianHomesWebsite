import asyncio
import json
from time import perf_counter
import re
import unicodedata
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import limiter
from app.core.metrics import observe_ai
from app.modules.activity.audit import audit_service
from app.infrastructure.ai_runtime import OllamaService
from app.modules.content.common.dependencies import marketing_user
from app.modules.content.seo_geo.html_sanitizer import sanitize_marketing_html
from app.modules.content.assistant.seo_service import PROMPT_VERSION, seo_generation_service, supported_evidence_payload
from app.db.mongodb import get_database

router = APIRouter(prefix="/ai", tags=["Protected AI"])
SEO_GENERATION_DEADLINE_SECONDS = 45.0


def _generation_warning(error_code: str | None) -> dict[str, str]:
    messages = {
        "GENERATION_TIMEOUT": "Gemini phản hồi quá thời gian. Vui lòng thử lại.",
        "MODEL_UNAVAILABLE": "Gemini đang tạm thời không khả dụng. Vui lòng thử lại sau ít phút.",
        "INVALID_MODEL_JSON": "Gemini trả về dữ liệu không đúng định dạng. Vui lòng thử lại.",
        "SCHEMA_VALIDATION_FAILED": "Nội dung AI chưa đạt cấu trúc SEO/GEO yêu cầu.",
        "INSUFFICIENT_VERIFIED_FACTS": "Nội dung cần ít nhất ba dữ kiện hoặc đoạn văn đầy đủ để tạo SEO/GEO.",
    }
    code = error_code or "AI_OUTPUT_INVALID"
    return {
        "code": code,
        "message": messages.get(
            code,
            "AI chưa tạo được nội dung có đủ căn cứ từ dữ liệu hiện tại.",
        ),
    }


def _link_tokens(value: str) -> set[str]:
    plain = unicodedata.normalize("NFD", value.casefold())
    plain = "".join(char for char in plain if unicodedata.category(char) != "Mn")
    return {token for token in re.findall(r"[a-z0-9]+", plain) if len(token) >= 4}


async def _verified_internal_links(text: str) -> list[dict]:
    database = get_database()
    projects = await database["projects"].find(
        {"is_published": True, "publication_status": "PUBLISHED"},
        {"name": 1, "slug": 1},
    ).limit(50).to_list(50)
    articles = await database["articles"].find(
        {"publication_status": "PUBLISHED"},
        {"title": 1, "slug": 1},
    ).limit(50).to_list(50)
    target = _link_tokens(text)
    candidates = [
        {"title": item.get("name"), "url": f"/du_an/{item.get('slug')}", "type": "project"}
        for item in projects if item.get("name") and item.get("slug")
    ] + [
        {"title": item.get("title"), "url": f"/tin_tuc/{item.get('slug')}", "type": "article"}
        for item in articles if item.get("title") and item.get("slug")
    ]
    scored = [(len(target & _link_tokens(str(item["title"]))), item) for item in candidates]
    return [item for score, item in sorted(scored, key=lambda pair: pair[0], reverse=True) if score > 0][:5]

class ProjectSEOSourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    url: str = Field(min_length=8, max_length=2048)
    publisher: str = Field(default="", max_length=200)

    @field_validator("url")
    @classmethod
    def verified_http_url(cls, value: str) -> str:
        if not re.fullmatch(r"https?://[^\s]+", value):
            raise ValueError("SOURCE_URL_INVALID")
        return value


class SEORequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_name: str = Field(..., min_length=2, max_length=200, description="Tên dự án bất động sản")
    description: str = Field("", max_length=20000, description="Mô tả tóm tắt dự án")
    location: str = Field(default="", max_length=500)
    developer: str = Field(default="", max_length=300)
    status: str = Field(default="", max_length=80)
    price_range: str = Field(default="", max_length=300)
    amenities: list[str] = Field(default_factory=list, max_length=50)
    marketing_tags: list[str] = Field(default_factory=list, max_length=30)
    sources: list[ProjectSEOSourceInput] = Field(default_factory=list, max_length=20)


class SEOSourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=300)
    url: str = Field(min_length=8, max_length=2048)
    publisher: str = Field(default="", max_length=200)

    @field_validator("url")
    @classmethod
    def verified_http_url(cls, value: str) -> str:
        if not re.fullmatch(r"https?://[^\s]+", value):
            raise ValueError("SOURCE_URL_INVALID")
        return value


class ArticleSEOGEORequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=5, max_length=200)
    sapo: str = Field(default="", max_length=1000)
    slug: str = Field(min_length=1, max_length=200)
    category: Literal["internal", "market", "project"] = "market"
    content: str = Field(default="", max_length=120000)
    sources: list[SEOSourceInput] = Field(default_factory=list, max_length=20)

class ChatPromptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = Field(..., min_length=1, max_length=2000, description="Nội dung câu hỏi gửi tới AI")
async def _collect_chat_reply(messages: list[dict]) -> str:
    chunks: list[str] = []
    async for chunk in OllamaService.chat_stream(messages, 0.2):
        if "content" in chunk:
            chunks.append(str(chunk["content"]))
    return "".join(chunks)
@router.post("/chat")
@limiter.limit("10/minute")
async def ai_chat(request: Request, payload: ChatPromptRequest, current_user: dict = Depends(get_current_user)):
    """AI Assistant (Yêu cầu login)"""
    messages_dict = [{"role": "user", "content": payload.prompt}]
    
    await audit_service.log(
        collection="ai",
        action="chat",
        actor_email=current_user.get("email"),
        actor_role=current_user.get("role"),
        message="Sử dụng Chat AI nội bộ"
    )

    full_reply = ""
    try:
        full_reply = await asyncio.wait_for(_collect_chat_reply(messages_dict), timeout=30.0)
        return {"reply": full_reply}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi kết nối dịch vụ AI. Vui lòng thử lại sau."
        )

@router.post("/seo")
@limiter.limit("10/minute")
async def generate_project_seo(request: Request, payload: SEORequest, current_user: dict = marketing_user):
    started = perf_counter()
    sources = [source.model_dump(mode="json") for source in payload.sources]
    source_length = len(payload.description.strip()) + len(payload.location.strip()) + len(payload.developer.strip()) + len(payload.status.strip()) + len(payload.price_range.strip()) + sum(len(item.strip()) for item in payload.amenities + payload.marketing_tags) + sum(len(source["title"]) + len(source.get("publisher") or "") for source in sources)
    if source_length < 100:
        elapsed_ms = round((perf_counter() - started) * 1000)
        observe_ai("project_seo", "needs_input", elapsed_ms / 1000)
        await audit_service.log(
            collection="ai", action="generate_seo", document_id=payload.project_name, actor_email=current_user.get("email"),
            actor_role=current_user.get("role"),
            message=f"project={payload.project_name};status=needs_input;latency_ms={elapsed_ms};error=PROJECT_EVIDENCE_REQUIRED",
            metadata={"entity_type": "PROJECT_SEO", "model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "status": "needs_input", "latency_ms": elapsed_ms, "validation_score": 0, "repair_count": 0, "error_code": "PROJECT_EVIDENCE_REQUIRED"},
        )
        return {
            "status": "needs_input", "data": None,
            "warnings": [{"code": "PROJECT_EVIDENCE_REQUIRED", "message": "Cần bổ sung tối thiểu 100 ký tự dữ liệu dự án đã xác minh trước khi tạo SEO/GEO."}],
            "validation": {"schema_valid": False, "evidence_valid": False},
            "generation": {"model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "latency_ms": elapsed_ms, "repairs": 0},
        }
    source_context = json.dumps({
        "description": payload.description, "location": payload.location, "developer": payload.developer,
        "status": payload.status, "price_range": payload.price_range, "amenities": payload.amenities,
        "marketing_tags": payload.marketing_tags,
        "editor_sources": [{"title": source["title"], "publisher": source.get("publisher") or ""} for source in sources],
    }, ensure_ascii=False)
    try:
        raw_suggestion, repairs, error = await asyncio.wait_for(
            seo_generation_service.project(payload.project_name, payload.description, source_context),
            timeout=SEO_GENERATION_DEADLINE_SECONDS,
        )
    except asyncio.TimeoutError:
        raw_suggestion, repairs, error = None, 0, "GENERATION_TIMEOUT"
    source_fields = {
        "content_type": "dự án bất động sản",
        "project_name": payload.project_name,
        "description": payload.description,
        "location": payload.location,
        "developer": payload.developer,
        "status": payload.status,
        "price_range": payload.price_range,
        "amenities": "\n".join(payload.amenities),
        "marketing_tags": "\n".join(payload.marketing_tags),
        "editor_sources": "\n".join(f"{source['title']} {source.get('publisher') or ''}" for source in sources),
    }
    evidence = {
        "all_supported": False,
        "returned_all_supported": False,
        "complete": False,
        "evidence": {},
        "unsupported": [],
        "supported_fields": [],
    }
    data = None
    if raw_suggestion:
        data, evidence = supported_evidence_payload(raw_suggestion, source_fields)
    response_status = "ok" if data else ("needs_input" if raw_suggestion else "unavailable")
    if response_status == "ok":
        data["sources"] = sources
        warnings = []
        if not evidence.get("complete"):
            warnings.append({
                "code": "PARTIAL_SUGGESTION",
                "message": "Một số trường AI chưa đủ căn cứ và đã được loại bỏ; chỉ các trường an toàn được trả về.",
            })
        warnings.append({
            "code": "SOURCE_REVIEW_REQUIRED",
            "message": "Nguồn, hình ảnh và alt text vẫn cần biên tập viên kiểm tra trước khi xuất bản.",
        })
    elif response_status == "needs_input":
        warnings = [{
            "code": "EVIDENCE_REQUIRED",
            "message": "Dữ liệu dự án chưa đủ để chứng minh các trường SEO cốt lõi. Hãy bổ sung mô tả, vị trí, chủ đầu tư hoặc tiện ích.",
        }]
    else:
        warnings = [_generation_warning(error)]
    elapsed_ms = round((perf_counter() - started) * 1000)
    observe_ai("project_seo", response_status, elapsed_ms / 1000, ["schema_repair"] if repairs else [])
    await audit_service.log(
        collection="ai", action="generate_seo", document_id=payload.project_name, actor_email=current_user.get("email"),
        actor_role=current_user.get("role"),
        message=f"project={payload.project_name};status={response_status};latency_ms={elapsed_ms};repairs={repairs};error={error or ''}",
        metadata={"entity_type": "PROJECT_SEO", "model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "status": response_status, "latency_ms": elapsed_ms, "validation_score": int(bool(data)), "repair_count": repairs, "error_code": error},
    )
    return {
        "status": response_status,
        "data": data,
        "warnings": warnings,
        "validation": {
            "schema_valid": raw_suggestion is not None,
            "evidence_valid": bool(data),
            "complete": bool(evidence.get("complete")),
            "supported_fields": evidence.get("supported_fields", []),
            "evidence": evidence.get("evidence", {}),
            "unsupported": evidence.get("unsupported", []),
        },
        "generation": {"model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "latency_ms": elapsed_ms, "repairs": repairs},
    }

@router.post("/article-seo-geo")
@limiter.limit("10/minute")
async def generate_article_seo_geo(
    request: Request,
    payload: ArticleSEOGEORequest,
    current_user: dict = marketing_user,
):
    started = perf_counter()
    sources = [source.model_dump(mode="json") for source in payload.sources]
    if payload.category == "market" and not sources:
        elapsed_ms = round((perf_counter() - started) * 1000)
        observe_ai("article_seo", "needs_input", elapsed_ms / 1000)
        await audit_service.log(
            collection="ai", action="generate_article_seo_geo", document_id=payload.slug,
            actor_email=current_user.get("email"), actor_role=current_user.get("role"),
            message=f"article={payload.title};status=needs_input;latency_ms={elapsed_ms};error=SOURCE_REQUIRED",
            metadata={"entity_type": "ARTICLE_SEO", "model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "status": "needs_input", "latency_ms": elapsed_ms, "validation_score": 0, "repair_count": 0, "error_code": "SOURCE_REQUIRED"},
        )
        return {
            "status": "needs_input", "data": None,
            "warnings": [{"code": "SOURCE_REQUIRED", "message": "Bài viết thị trường cần ít nhất một nguồn tham khảo do biên tập viên xác minh."}],
            "validation": {"schema_valid": False, "sources_valid": False},
            "generation": {"model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "latency_ms": elapsed_ms, "repairs": 0},
        }
    clean_content = re.sub(r"<[^>]+>", " ", sanitize_marketing_html(payload.content))
    try:
        raw_suggestion, repairs, error = await asyncio.wait_for(
            seo_generation_service.article(payload.title, payload.sapo, payload.category, clean_content, sources),
            timeout=SEO_GENERATION_DEADLINE_SECONDS,
        )
    except asyncio.TimeoutError:
        raw_suggestion, repairs, error = None, 0, "GENERATION_TIMEOUT"
    source_fields = {
        "content_type": "bài viết bất động sản",
        "title": payload.title,
        "sapo": payload.sapo,
        **{
            f"content.chunk.{index // 6000}": clean_content[index:index + 6000]
            for index in range(0, len(clean_content), 6000)
        },
        "editor_sources": "\n".join(f"{source['title']} {source.get('publisher') or ''}" for source in sources),
    }
    evidence = {
        "all_supported": False,
        "returned_all_supported": False,
        "complete": False,
        "evidence": {},
        "unsupported": [],
        "supported_fields": [],
    }
    data = None
    if raw_suggestion:
        data, evidence = supported_evidence_payload(raw_suggestion, source_fields)
    sources_required = payload.category == "market"
    sources_valid = bool(sources) if sources_required else True
    response_status = "ok" if data and sources_valid else ("needs_input" if raw_suggestion else "unavailable")
    if response_status == "ok":
        data["canonical_url"] = f"{settings.PUBLIC_SITE_URL.rstrip('/')}/tin_tuc/{payload.slug}"
        data["internal_links"] = await _verified_internal_links(f"{payload.title}\n{payload.sapo}\n{clean_content}")
        warnings = []
        if not evidence.get("complete"):
            warnings.append({
                "code": "PARTIAL_SUGGESTION",
                "message": "Một số trường AI chưa đủ căn cứ và đã được loại bỏ; chỉ các trường an toàn được trả về.",
            })
        warnings.append({
            "code": "EDITOR_GATE_REVIEW_REQUIRED",
            "message": "Nguồn, hình ảnh và alt text vẫn cần biên tập viên kiểm tra trước khi xuất bản.",
        })
    elif response_status == "needs_input":
        warnings = [{
            "code": "EVIDENCE_REQUIRED",
            "message": "Nội dung bài viết chưa đủ để chứng minh các trường SEO cốt lõi. Hãy bổ sung ít nhất ba dữ kiện rõ ràng.",
        }]
    else:
        warnings = [_generation_warning(error)]
    elapsed_ms = round((perf_counter() - started) * 1000)
    observe_ai("article_seo", response_status, elapsed_ms / 1000, ["schema_repair"] if repairs else [])
    await audit_service.log(
        collection="ai", action="generate_article_seo_geo", document_id=payload.slug,
        actor_email=current_user.get("email"), actor_role=current_user.get("role"),
        message=f"article={payload.title};status={response_status};latency_ms={elapsed_ms};repairs={repairs};error={error or ''}",
        metadata={"entity_type": "ARTICLE_SEO", "model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "status": response_status, "latency_ms": elapsed_ms, "validation_score": int(bool(data) and sources_valid), "repair_count": repairs, "error_code": error},
    )
    return {
        "status": response_status,
        "data": data,
        "warnings": warnings,
        "validation": {"schema_valid": raw_suggestion is not None, "sources_required": sources_required, "sources_valid": sources_valid, "evidence_valid": bool(data), "complete": bool(evidence.get("complete")), "supported_fields": evidence.get("supported_fields", []), "evidence": evidence.get("evidence", {}), "unsupported": evidence.get("unsupported", [])},
        "generation": {"model": OllamaService.active_model(), "prompt_version": PROMPT_VERSION, "latency_ms": elapsed_ms, "repairs": repairs},
    }
