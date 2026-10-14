from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from app.db.mongodb import get_database

VN_TZ = timezone(timedelta(hours=7))

FORM_LABELS: dict[str, str] = {
    "COWORKING_CONSULTATION_HERO": "Đăng ký tư vấn Coworking (Đầu trang)",
    "coworking-consultation-modal": "Đăng ký tham quan / xem chỗ Coworking",
    "coworking-inquiry": "Tư vấn gói dịch vụ Coworking",
    "office-inquiry": "Tư vấn thuê văn phòng trọn gói",
    "consignment": "Ký gửi Bất động sản",
    "contact_form": "Form liên hệ trực tiếp",
    "website-contact": "Liên hệ chung từ website",
    "project-inquiry": "Đăng ký tư vấn dự án",
}

SOURCE_LABELS: dict[str, str] = {
    "COWORKING": "Không gian Coworking Space",
    "OFFICE": "Cho thuê Văn phòng",
    "WEBSITE": "Website chung & Liên hệ",
    "CONSIGNMENT": "Ký gửi Bất động sản",
    "PROJECT": "Dự án Bất động sản",
    "GENERAL": "Chung",
}

PAGE_LABELS: dict[str, str] = {
    "home": "Trang chủ (Home)",
    "coworking_landing": "Landing Page Coworking",
    "office_landing": "Cho thuê Văn phòng",
    "consignment": "Trang Ký gửi BĐS",
    "about": "Giới thiệu Maian Homes",
    "contact": "Trang Liên hệ",
}

STATUS_CONFIG: dict[str, dict[str, str]] = {
    "NEW": {"label": "Chờ tiếp nhận", "color": "#E11D48"},
    "VIEWED": {"label": "Đã xem", "color": "#2563EB"},
    "EXPORTED": {"label": "Đã xuất dữ liệu", "color": "#059669"},
    "ARCHIVED": {"label": "Lưu trữ", "color": "#64748B"},
}


class WebsiteAnalyticsService:
    @property
    def collection(self):
        return get_database()["website_leads"]

    def _resolve_date_range(
        self,
        period: str = "30d",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> tuple[datetime | None, datetime | None, datetime | None, datetime | None, int]:
        now_vn = datetime.now(VN_TZ)
        now_utc = datetime.now(timezone.utc)

        if date_from or date_to:
            dt_from = (
                datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                if date_from
                else None
            )
            dt_to = (
                datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                if date_to
                else now_utc
            )
            duration_days = (
                max(1, (dt_to - dt_from).days) if dt_from and dt_to else 30
            )
            prev_from = dt_from - timedelta(days=duration_days) if dt_from else None
            prev_to = dt_from if dt_from else None
            return dt_from, dt_to, prev_from, prev_to, duration_days

        period = (period or "30d").lower()
        if period == "today":
            start_vn = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
            dt_from = start_vn.astimezone(timezone.utc)
            dt_to = now_utc
            prev_from = dt_from - timedelta(days=1)
            prev_to = dt_from
            return dt_from, dt_to, prev_from, prev_to, 1

        elif period == "7d":
            dt_from = now_utc - timedelta(days=7)
            dt_to = now_utc
            prev_from = dt_from - timedelta(days=7)
            prev_to = dt_from
            return dt_from, dt_to, prev_from, prev_to, 7

        elif period == "this_month":
            start_month_vn = now_vn.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            dt_from = start_month_vn.astimezone(timezone.utc)
            dt_to = now_utc
            duration_days = max(1, (dt_to - dt_from).days)
            prev_from = dt_from - timedelta(days=duration_days)
            prev_to = dt_from
            return dt_from, dt_to, prev_from, prev_to, duration_days

        elif period == "all":
            return None, None, None, None, 0

        else:  # default 30d
            dt_from = now_utc - timedelta(days=30)
            dt_to = now_utc
            prev_from = dt_from - timedelta(days=30)
            prev_to = dt_from
            return dt_from, dt_to, prev_from, prev_to, 30

    async def get_summary(
        self,
        period: str = "30d",
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> dict[str, Any]:
        dt_from, dt_to, prev_from, prev_to, duration_days = self._resolve_date_range(
            period, date_from, date_to
        )

        match_filter: dict[str, Any] = {}
        if dt_from or dt_to:
            time_filter: dict[str, Any] = {}
            if dt_from:
                time_filter["$gte"] = dt_from
            if dt_to:
                time_filter["$lte"] = dt_to
            match_filter["submitted_at"] = time_filter

        # 1. Total leads in period
        total_leads = await self.collection.count_documents(match_filter)

        # 2. Status distribution
        status_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        status_counts: dict[str, int] = {
            doc["_id"]: doc["count"]
            async for doc in self.collection.aggregate(status_pipeline)
            if doc.get("_id")
        }

        new_count = status_counts.get("NEW", 0)
        viewed_count = status_counts.get("VIEWED", 0)
        exported_count = status_counts.get("EXPORTED", 0)
        archived_count = status_counts.get("ARCHIVED", 0)
        processed_count = viewed_count + exported_count + archived_count
        response_rate = (
            round((processed_count / total_leads) * 100, 1) if total_leads > 0 else 0.0
        )

        # 3. Growth compared to previous period
        prev_total = 0
        if prev_from and prev_to:
            prev_filter = {"submitted_at": {"$gte": prev_from, "$lte": prev_to}}
            prev_total = await self.collection.count_documents(prev_filter)

        growth_rate = 0.0
        if prev_total > 0:
            growth_rate = round(((total_leads - prev_total) / prev_total) * 100, 1)
        elif total_leads > 0 and prev_total == 0:
            growth_rate = 100.0

        # 4. Timeline aggregation (per day in VN timezone)
        timeline_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$submitted_at",
                            "timezone": "+07:00",
                        }
                    },
                    "count": {"$sum": 1},
                    "new_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "NEW"]}, 1, 0]}
                    },
                }
            },
            {"$sort": {"_id": 1}},
        ]
        timeline_raw = {
            doc["_id"]: {"count": doc["count"], "new_count": doc["new_count"]}
            async for doc in self.collection.aggregate(timeline_pipeline)
            if doc.get("_id")
        }

        # Build contiguous date list if duration is <= 90 days
        timeline: list[dict[str, Any]] = []
        if dt_from and dt_to and duration_days <= 90:
            cur = dt_from.astimezone(VN_TZ).date()
            end_d = dt_to.astimezone(VN_TZ).date()
            while cur <= end_d:
                d_str = cur.isoformat()
                item = timeline_raw.get(d_str, {"count": 0, "new_count": 0})
                timeline.append({
                    "date": d_str,
                    "count": item["count"],
                    "new_count": item["new_count"],
                })
                cur += timedelta(days=1)
        else:
            # For 'all' or large ranges, use direct sorted points
            timeline = [
                {"date": d_str, "count": data["count"], "new_count": data["new_count"]}
                for d_str, data in sorted(timeline_raw.items())
            ]

        # 5. Breakdown by Form
        form_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {"$group": {"_id": "$form_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        by_form: list[dict[str, Any]] = []
        async for doc in self.collection.aggregate(form_pipeline):
            fid = str(doc.get("_id") or "unspecified")
            c = doc["count"]
            pct = round((c / total_leads) * 100, 1) if total_leads > 0 else 0.0
            label = FORM_LABELS.get(fid, fid.replace("_", " ").title())
            by_form.append({"form_id": fid, "label": label, "count": c, "percentage": pct})

        # 6. Breakdown by Source (Product line)
        source_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {"$group": {"_id": "$source", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        by_source: list[dict[str, Any]] = []
        async for doc in self.collection.aggregate(source_pipeline):
            src = str(doc.get("_id") or "OTHER")
            c = doc["count"]
            pct = round((c / total_leads) * 100, 1) if total_leads > 0 else 0.0
            label = SOURCE_LABELS.get(src, src)
            by_source.append({"source": src, "label": label, "count": c, "percentage": pct})

        # 7. Breakdown by UTM Source (Marketing Channel)
        utm_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {"$group": {"_id": {"$ifNull": ["$utm_source", "direct"]}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        by_utm: list[dict[str, Any]] = []
        async for doc in self.collection.aggregate(utm_pipeline):
            raw_utm = str(doc.get("_id") or "direct").strip().lower()
            c = doc["count"]
            pct = round((c / total_leads) * 100, 1) if total_leads > 0 else 0.0
            
            # Map common marketing channel names
            label_map = {
                "direct": "Truy cập trực tiếp (Direct / Organic)",
                "facebook": "Facebook Ads / Social",
                "fb": "Facebook Ads",
                "google": "Google Search / Ads",
                "gg": "Google Ads",
                "zalo": "Zalo Marketing",
                "tiktok": "TikTok",
                "email": "Email Campaign",
            }
            channel_label = label_map.get(raw_utm, raw_utm.capitalize())
            by_utm.append({"source": raw_utm, "label": channel_label, "count": c, "percentage": pct})

        # 8. Top converting pages
        pages_pipeline: list[dict[str, Any]] = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": {
                        "page_key": {"$ifNull": ["$page_key", ""]},
                        "page_url": {"$ifNull": ["$page_url", ""]},
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": 5},
        ]
        top_pages: list[dict[str, Any]] = []
        async for doc in self.collection.aggregate(pages_pipeline):
            info = doc.get("_id") or {}
            pkey = info.get("page_key") or ""
            purl = info.get("page_url") or ""
            c = doc["count"]
            pct = round((c / total_leads) * 100, 1) if total_leads > 0 else 0.0
            label = PAGE_LABELS.get(pkey) or (purl if purl else (pkey or "Trang không xác định"))
            top_pages.append({
                "page_key": pkey,
                "page_url": purl,
                "label": label,
                "count": c,
                "percentage": pct,
            })

        # 9. Recent leads in period (last 5)
        recent_cursor = (
            self.collection.find(match_filter)
            .sort("submitted_at", -1)
            .limit(5)
        )
        recent_leads: list[dict[str, Any]] = []
        async for doc in recent_cursor:
            fid = doc.get("form_id") or ""
            status_val = doc.get("status") or "NEW"
            status_meta = STATUS_CONFIG.get(status_val, {"label": status_val, "color": "#64748B"})
            recent_leads.append({
                "id": str(doc["_id"]),
                "customer_name": doc.get("customer_name") or "Khách hàng",
                "phone": doc.get("phone") or "",
                "email": doc.get("email"),
                "form_id": fid,
                "form_label": FORM_LABELS.get(fid, fid),
                "status": status_val,
                "status_label": status_meta["label"],
                "status_color": status_meta["color"],
                "submitted_at": doc.get("submitted_at").isoformat() if doc.get("submitted_at") else "",
            })

        # By status structured list
        by_status = [
            {
                "status": st,
                "label": meta["label"],
                "color": meta["color"],
                "count": status_counts.get(st, 0),
                "percentage": (
                    round((status_counts.get(st, 0) / total_leads) * 100, 1)
                    if total_leads > 0
                    else 0.0
                ),
            }
            for st, meta in STATUS_CONFIG.items()
        ]

        return {
            "period": period,
            "duration_days": duration_days,
            "overview": {
                "total": total_leads,
                "new": new_count,
                "viewed": viewed_count,
                "exported": exported_count,
                "archived": archived_count,
                "processed": processed_count,
                "response_rate": response_rate,
                "previous_period_total": prev_total,
                "growth_rate": growth_rate,
            },
            "timeline": timeline,
            "by_form": by_form,
            "by_source": by_source,
            "by_utm_source": by_utm,
            "by_status": by_status,
            "top_pages": top_pages,
            "recent_leads": recent_leads,
        }


analytics_service = WebsiteAnalyticsService()
