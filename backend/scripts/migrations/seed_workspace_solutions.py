import asyncio
import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_workspace")

MONGODB_URL = settings.MONGODB_URL
DATABASE_NAME = settings.DATABASE_NAME


def utcnow():
    return datetime.now(timezone.utc)


async def seed_workspace_data():
    client = AsyncIOMotorClient(MONGODB_URL, tz_aware=True)
    db = client[DATABASE_NAME]

    now = utcnow()
    logger.info("Starting Workspace Solutions database seed...")

    # 1. Seed Coworking Space (Singleton location)
    coworking_doc = {
        "key": "singleton_location",
        "name": "Maian Co-working Space",
        "slug": "coworking",
        "status": "PUBLISHED",
        "version": 1,
        "published_version": 1,
        "hero": {
            "title": "MAIAN HOMES | CO-WORKING SPACE",
            "subtitle": "Không gian làm việc linh hoạt, kết nối và phát triển",
            "description": "Khám phá giải pháp cho thuê chỗ ngồi làm việc dành cho cá nhân, freelancer, startup và doanh nghiệp tại TP.HCM.",
            "image_url": "/images/coworking/hero.jpg",
            "cta_tour_label": "ĐĂNG KÝ THAM QUAN",
            "cta_consult_label": "NHẬN TƯ VẤN",
        },
        "introduction": {
            "title": "Không Gian Khơi Nguồn Sáng Tạo & Hiệu Suất",
            "short_desc": "Môi trường làm việc hiện đại, năng động tại vị trí giao thông kết nối hoàn hảo.",
            "full_desc": "Co-working Space tại Maian Homes được đầu tư bài bản với thiết kế không gian mở thoáng đãng, bàn ghế công thái học cao cấp và ánh sáng tự nhiên ngập tràn. Chúng tôi mang đến hệ sinh thái văn phòng tiện nghi trọn gói giúp bạn và đội ngũ tối ưu hóa năng suất làm việc, mở rộng mối quan hệ và tiếp cận những cơ hội kinh doanh mới.",
            "target_audience": [
                "Freelancer & Chuyên gia làm việc tự do",
                "Startup & Đội ngũ công nghệ",
                "Chuyên gia tư vấn & Đại diện thương mại",
                "Doanh nghiệp vừa và nhỏ (SMEs)",
            ],
            "highlights": [
                "Vị trí trung tâm Quận 10 – kết nối thuận tiện Quận 1, 3, 5, 11",
                "Internet cáp quang chuyên dụng tốc độ 500Mbps có backup",
                "Không gian mở kết hợp khu làm việc yên tĩnh chuyên biệt",
                "Miễn phí tiện ích văn phòng, trà, cà phê và phòng tiếp khách",
            ],
            "image_url": "/images/coworking/intro.jpg",
        },
        "location": {
            "address": "Số 606/62 đường 3 Tháng 2, Phường Diên Hồng, TP. Hồ Chí Minh",
            "district": "Quận 10",
            "city": "TP. Hồ Chí Minh",
            "latitude": 10.7688,
            "longitude": 106.6654,
            "map_embed_url": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.646549219358!2d106.6632!3d10.7688!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDQ2JzA3LjciTiAxMDbCsDM5JzQ3LjUiRQ!5e0!3m2!1svi!2s!4v1600000000000!5m2!1svi!2s",
            "directions_url": "https://maps.google.com/?q=606/62+Đường+3+Tháng+2,+Phường+Diên+Hồng,+TP.HCM",
            "contact_phone": "0901 234 567",
            "contact_email": "contact@maianhomes.vn",
            "operating_hours": "08:00 - 21:00 (Thứ 2 - Thứ 7)",
        },
        "amenities": [
            {"id": "amenity-1", "icon": "Wifi", "name": "Wifi tốc độ cao băng thông rộng", "description": "Hệ thống wifi mesh chịu tải cao 500Mbps", "is_active": True, "display_order": 1},
            {"id": "amenity-2", "icon": "Users", "name": "Phòng họp tiêu chuẩn quốc tế", "description": "Trang bị màn hình 4K và micro hội nghị trực tuyến", "is_active": True, "display_order": 2},
            {"id": "amenity-3", "icon": "Printer", "name": "Máy in / photocopy đa năng", "description": "Hỗ trợ in ấn tài liệu hai mặt sắc nét", "is_active": True, "display_order": 3},
            {"id": "amenity-4", "icon": "Coffee", "name": "Pantry trà & cà phê tươi miễn phí", "description": "Khu nghỉ ngơi tái tạo năng lượng với đồ uống thanh mát", "is_active": True, "display_order": 4},
            {"id": "amenity-5", "icon": "Wind", "name": "Điều hòa trung tâm êm ái", "description": "Lọc không khí và duy trì nhiệt độ tối ưu 24°C", "is_active": True, "display_order": 5},
            {"id": "amenity-6", "icon": "Car", "name": "Bãi đỗ xe an toàn", "description": "Hầm đỗ xe rộng rãi cho xe máy và ô tô", "is_active": True, "display_order": 6},
            {"id": "amenity-7", "icon": "Smile", "name": "Lễ tân chuyên nghiệp & nhận thư tín", "description": "Tiếp đón đối tác khách hàng chu đáo", "is_active": True, "display_order": 7},
            {"id": "amenity-8", "icon": "ShieldCheck", "name": "An ninh & camera giám sát 24/7", "description": "Kiểm soát ra vào bằng thẻ từ vân tay", "is_active": True, "display_order": 8},
        ],
        "gallery": [
            {"id": "gal-1", "url": "/images/coworking/gallery-1.jpg", "alt_text": "Khu vực chỗ ngồi làm việc mở", "caption": "Không gian làm việc linh hoạt", "is_primary": True, "display_order": 1},
            {"id": "gal-2", "url": "/images/coworking/gallery-2.jpg", "alt_text": "Bàn làm việc cố định công thái học", "caption": "Ghế chống mỏi và bàn làm việc cá nhân", "is_primary": False, "display_order": 2},
            {"id": "gal-3", "url": "/images/coworking/gallery-3.jpg", "alt_text": "Phòng họp họp nhóm chuyên nghiệp", "caption": "Phòng họp hiện đại cách âm", "is_primary": False, "display_order": 3},
            {"id": "gal-4", "url": "/images/coworking/gallery-4.jpg", "alt_text": "Khu vực pantry và thư giãn", "caption": "Quầy bar pantry thư giãn", "is_primary": False, "display_order": 4},
        ],
        "seo_metadata": {
            "title": "Co-working Space TP.HCM | Cho Thuê Chỗ Ngồi Làm Việc – Maian Homes",
            "description": "Khám phá dịch vụ cho thuê chỗ ngồi làm việc Co-working Space tại TP.HCM. Tìm hiểu không gian, tiện ích, giá thuê và đăng ký tư vấn cùng Maian Homes.",
            "canonical_url": "https://maianhomes.vn/dich-vu-cho-thue/coworking",
            "robots": "index, follow",
            "og_title": "Co-working Space TP.HCM | Cho Thuê Chỗ Ngồi Làm Việc – Maian Homes",
            "og_description": "Khám phá dịch vụ cho thuê chỗ ngồi làm việc Co-working Space tại TP.HCM. Tìm hiểu không gian, tiện ích, giá thuê và đăng ký tư vấn cùng Maian Homes.",
            "og_image": "/images/coworking/hero.jpg",
            "focus_keyword": "cho thuê chỗ ngồi làm việc tphcm",
            "h1": "Cho Thuê Chỗ Ngồi Làm Việc Co-working Space Tại TP.HCM",
        },
        "created_at": now,
        "updated_at": now,
    }
    coworking_doc["published_snapshot"] = dict(coworking_doc)
    await db["workspace_coworking"].update_one(
        {"key": "singleton_location"},
        {"$set": coworking_doc},
        upsert=True,
    )

    # 2. Seed Seat Types
    await db["workspace_seat_types"].delete_many({})
    hot_desk_res = await db["workspace_seat_types"].insert_one({
        "space_key": "singleton_location",
        "name": "Chỗ ngồi linh hoạt (Hot Desk)",
        "code": "HOT_DESK",
        "description": "Tự do lựa chọn bất kỳ vị trí ngồi nào trong không gian mở. Thích hợp cho cá nhân làm việc di động, freelancer và nhu cầu làm việc ngắn hạn.",
        "image_url": "/images/coworking/hot-desk.jpg",
        "capacity": 35,
        "reference_price": "Từ 150.000 đ/ngày",
        "status": "ACTIVE",
        "display_order": 1,
        "created_at": now,
        "updated_at": now,
    })
    hot_desk_id = str(hot_desk_res.inserted_id)

    dedicated_desk_res = await db["workspace_seat_types"].insert_one({
        "space_key": "singleton_location",
        "name": "Chỗ ngồi cố định (Dedicated Desk)",
        "code": "DEDICATED_DESK",
        "description": "Bàn làm việc riêng biệt cố định của bạn kèm hộc tủ cá nhân có khóa an toàn. Phù hợp cho cá nhân cần làm việc toàn thời gian lâu dài.",
        "image_url": "/images/coworking/dedicated-desk.jpg",
        "capacity": 20,
        "reference_price": "Từ 2.500.000 đ/tháng",
        "status": "ACTIVE",
        "display_order": 2,
        "created_at": now,
        "updated_at": now,
    })
    dedicated_desk_id = str(dedicated_desk_res.inserted_id)

    # 3. Seed Pricing Plans
    await db["workspace_pricing_plans"].delete_many({})
    plans_data = [
        {
            "space_key": "singleton_location",
            "seat_type_id": hot_desk_id,
            "seat_type_name": "Chỗ ngồi linh hoạt",
            "name": "Gói Ngày Linh Hoạt",
            "code": "PLAN_HOT_DAY",
            "description": "Trải nghiệm không gian làm việc chuyên nghiệp trọn vẹn 1 ngày.",
            "price": 150000,
            "currency": "VND",
            "billing_period": "NGAY",
            "duration": "1 ngày làm việc (08:00 - 21:00)",
            "benefits": [
                "Chỗ ngồi tự do trong khu vực mở",
                "Internet cáp quang không giới hạn",
                "Miễn phí trà, nước tinh khiết tại pantry",
                "Hỗ trợ in ấn tài liệu 10 trang trắng đen",
            ],
            "extra_fees": "Chưa bao gồm VAT (nếu xuất hóa đơn)",
            "is_featured": False,
            "status": "ACTIVE",
            "display_order": 1,
            "created_at": now,
            "updated_at": now,
        },
        {
            "space_key": "singleton_location",
            "seat_type_id": hot_desk_id,
            "seat_type_name": "Chỗ ngồi linh hoạt",
            "name": "Gói Tuần Linh Hoạt",
            "code": "PLAN_HOT_WEEK",
            "description": "Tối ưu chi phí cho các dự án chạy nước rút trong tuần.",
            "price": 800000,
            "currency": "VND",
            "billing_period": "TUAN",
            "duration": "6 ngày làm việc liên tiếp",
            "benefits": [
                "Chỗ ngồi linh hoạt toàn bộ thời gian",
                "Internet tốc độ cao không giới hạn",
                "Tặng 1 giờ sử dụng phòng họp tiêu chuẩn",
                "In ấn 30 trang tài liệu miễn phí",
                "Pantry trà & cà phê tươi mỗi ngày",
            ],
            "extra_fees": "Chưa bao gồm VAT",
            "is_featured": False,
            "status": "ACTIVE",
            "display_order": 2,
            "created_at": now,
            "updated_at": now,
        },
        {
            "space_key": "singleton_location",
            "seat_type_id": hot_desk_id,
            "seat_type_name": "Chỗ ngồi linh hoạt",
            "name": "Gói Tháng Linh Hoạt (Hot Desk)",
            "code": "PLAN_HOT_MONTH",
            "description": "Lựa chọn phổ biến nhất cho chuyên gia và freelancer làm việc ổn định.",
            "price": 2200000,
            "currency": "VND",
            "billing_period": "THANG",
            "duration": "30 ngày kể từ ngày kích hoạt",
            "benefits": [
                "Truy cập không giới hạn trong giờ hoạt động",
                "Tặng 3 giờ sử dụng phòng họp VIP mỗi tháng",
                "Miễn phí 100 trang in ấn tài liệu",
                "Hỗ trợ tiếp nhận bưu phẩm và thư từ",
                "Giảm 15% khi thuê phòng họp thêm giờ",
            ],
            "extra_fees": "Chưa bao gồm VAT",
            "is_featured": True,
            "status": "ACTIVE",
            "display_order": 3,
            "created_at": now,
            "updated_at": now,
        },
        {
            "space_key": "singleton_location",
            "seat_type_id": dedicated_desk_id,
            "seat_type_name": "Chỗ ngồi cố định",
            "name": "Gói Tháng Cố Định (Dedicated Desk)",
            "code": "PLAN_DEDICATED_MONTH",
            "description": "Không gian riêng tư ổn định dành cho cá nhân làm việc chuyên sâu.",
            "price": 2800000,
            "currency": "VND",
            "billing_period": "THANG",
            "duration": "30 ngày (Gia hạn hàng tháng)",
            "benefits": [
                "Bàn làm việc riêng tư cố định 100%",
                "Hộc tủ tài liệu cá nhân có khóa mã số riêng",
                "Tặng 5 giờ sử dụng phòng họp chất lượng cao",
                "In ấn tài liệu 150 trang miễn phí",
                "Đặt bảng tên cá nhân/công ty tại bàn làm việc",
                "Ưu tiên chỗ đỗ xe tại hầm tòa nhà",
            ],
            "extra_fees": "Chưa bao gồm VAT",
            "is_featured": False,
            "status": "ACTIVE",
            "display_order": 4,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db["workspace_pricing_plans"].insert_many(plans_data)

    # 4. Seed Office Landing
    office_landing = {
        "key": "office_landing",
        "hero_title": "MAIAN HOMES | OFFICE LEASING",
        "hero_subtitle": "VĂN PHÒNG CHO THUÊ TẠI TP.HCM",
        "hero_description": "Không gian làm việc chuyên nghiệp, đa dạng diện tích và vị trí, phù hợp với nhu cầu phát triển của doanh nghiệp.",
        "hero_image_url": "/images/office/hero.jpg",
        "intro_title": "Giải Pháp Văn Phòng Cho Thuê Hạng A – C Toàn Diện",
        "intro_description": "Với mạng lưới đối tác tòa nhà rộng khắp các quận trung tâm TP.HCM, Maian Homes mang đến dịch vụ tư vấn thuê văn phòng chuyên nghiệp, minh bạch về giá, diện tích và hợp đồng pháp lý, giúp doanh nghiệp tiết kiệm tối đa thời gian và chi phí đầu tư ban đầu.",
        "cta_consult_label": "NHẬN TƯ VẤN VĂN PHÒNG",
        "cta_list_label": "XEM DANH SÁCH TÒA NHÀ",
        "status": "PUBLISHED",
        "version": 1,
        "published_version": 1,
        "seo_metadata": {
            "title": "Văn Phòng Cho Thuê TP.HCM | Office Leasing – Maian Homes",
            "description": "Tìm kiếm văn phòng cho thuê tại TP.HCM theo khu vực, diện tích và ngân sách. Khám phá danh sách tòa nhà và nhận tư vấn từ Maian Homes.",
            "canonical_url": "https://maianhomes.vn/dich-vu-cho-thue/office",
            "robots": "index, follow",
            "og_title": "Văn Phòng Cho Thuê TP.HCM | Office Leasing – Maian Homes",
            "og_description": "Tìm kiếm văn phòng cho thuê tại TP.HCM theo khu vực, diện tích và ngân sách. Khám phá danh sách tòa nhà và nhận tư vấn từ Maian Homes.",
            "og_image": "/images/office/hero.jpg",
            "focus_keyword": "văn phòng cho thuê tphcm",
            "h1": "Văn Phòng Cho Thuê Tại TP.HCM",
        },
        "created_at": now,
        "updated_at": now,
    }
    office_landing["published_snapshot"] = dict(office_landing)
    await db["workspace_office_landing"].update_one(
        {"key": "office_landing"},
        {"$set": office_landing},
        upsert=True,
    )

    # 5. Seed Office Buildings & Units
    await db["workspace_office_buildings"].delete_many({})
    await db["workspace_office_units"].delete_many({})

    # Building 1: Maian Tower Central
    b1_res = await db["workspace_office_buildings"].insert_one({
        "name": "Maian Tower Central",
        "slug": "maian-tower-central",
        "code": "BLD_MTC_01",
        "address": "Số 606/62 đường 3 Tháng 2, Phường Diên Hồng, TP. Hồ Chí Minh",
        "district": "Quận 10",
        "city": "TP. Hồ Chí Minh",
        "building_grade": "A",
        "total_floors": "18 tầng nổi, 2 tầng hầm",
        "description": "Maian Tower Central là tòa nhà văn phòng cao cấp chuẩn hạng A tọa lạc tại trục đường huyết mạch 3 Tháng 2. Tòa nhà sở hữu kiến trúc hiện đại, mặt kính phản quang cách nhiệt, 4 thang máy tốc độ cao và hệ thống quản lý tòa nhà thông minh BMS.",
        "highlights": [
            "Vị trí đắc địa tại trung tâm kinh tế sầm uất Quận 10",
            "Sàn văn phòng vuông vức, không vướng cột, tối ưu công năng",
            "Hệ thống điều hòa trung tâm VRV Daikin tiết kiệm năng lượng",
            "Hệ thống PCCC tự động đạt chuẩn thẩm duyệt quốc tế",
        ],
        "amenities": [
            "4 thang máy Schindler tốc độ cao 2.5m/s",
            "Máy phát điện dự phòng Cummins 100% công suất",
            "Bãi đỗ xe 2 tầng hầm rộng hơn 3.000m²",
            "Lễ tân tiếp đón & bảo vệ an ninh 24/7",
            "Ngân hàng giao dịch và cafe tầng trệt",
        ],
        "images": [
            {"id": "b1-img-1", "url": "/images/office/building-1.jpg", "alt_text": "Mặt tiền tòa nhà Maian Tower Central", "is_primary": True, "display_order": 1},
            {"id": "b1-img-2", "url": "/images/office/b1-lobby.jpg", "alt_text": "Sảnh lễ tân sang trọng", "is_primary": False, "display_order": 2},
            {"id": "b1-img-3", "url": "/images/office/b1-floor.jpg", "alt_text": "Mặt bằng sàn văn phòng vuông vức", "is_primary": False, "display_order": 3},
        ],
        "map_embed_url": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.646549219358!2d106.6632!3d10.7688!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDQ2JzA3LjciTiAxMDbCsDM5JzQ3LjUiRQ!5e0!3m2!1svi!2s!4v1600000000000!5m2!1svi!2s",
        "directions_url": "https://maps.google.com/?q=606/62+Đường+3+Tháng+2,+Phường+Diên+Hồng,+TP.HCM",
        "contact_phone": "0901 234 567",
        "contact_email": "leasing@maianhomes.vn",
        "status": "PUBLISHED",
        "version": 1,
        "published_version": 1,
        "display_order": 1,
        "seo_metadata": {
            "title": "Maian Tower Central | Cho Thuê Văn Phòng Hạng A Quận 10 – Maian Homes",
            "description": "Cho thuê văn phòng tại Maian Tower Central, Quận 10. Đa dạng diện tích 85m2 - 450m2, giá thuê cạnh tranh từ $26/m2, tiêu chuẩn Hạng A cao cấp.",
            "canonical_url": "https://maianhomes.vn/dich-vu-cho-thue/office/maian-tower-central",
            "robots": "index, follow",
            "og_title": "Cho Thuê Văn Phòng Maian Tower Central Quận 10",
            "og_description": "Văn phòng Hạng A cao cấp, diện tích linh hoạt 85m2 - 450m2.",
            "og_image": "/images/office/building-1.jpg",
            "focus_keyword": "cho thuê văn phòng maian tower central",
            "h1": "Cho Thuê Văn Phòng Maian Tower Central",
        },
        "created_at": now,
        "updated_at": now,
    })
    b1_id = str(b1_res.inserted_id)

    # Units for Building 1
    units_b1 = [
        {
            "building_id": b1_id,
            "unit_code": "MTC-L04-A",
            "floor": "Tầng 4",
            "area": 85.0,
            "rental_price": 26.0,
            "currency": "USD",
            "price_unit": "m2/tháng",
            "management_fee": "5 USD/m2/tháng",
            "extra_fees": "Điện lạnh theo đồng hồ thực tế, VAT 10%",
            "availability_status": "AVAILABLE",
            "available_from": "Bàn giao ngay",
            "notes": "Đã hoàn thiện sàn nâng kỹ thuật, trần thả thạch cao, view mặt tiền đường.",
            "status": "ACTIVE",
            "display_order": 1,
            "created_at": now,
            "updated_at": now,
        },
        {
            "building_id": b1_id,
            "unit_code": "MTC-L08-B",
            "floor": "Tầng 8",
            "area": 160.0,
            "rental_price": 27.5,
            "currency": "USD",
            "price_unit": "m2/tháng",
            "management_fee": "5 USD/m2/tháng",
            "extra_fees": "Điện lạnh theo đồng hồ, VAT 10%",
            "availability_status": "AVAILABLE",
            "available_from": "Bàn giao ngay",
            "notes": "Mặt bằng góc 2 mặt thoáng view panorama, thích hợp cho công ty 30-50 nhân sự.",
            "status": "ACTIVE",
            "display_order": 2,
            "created_at": now,
            "updated_at": now,
        },
        {
            "building_id": b1_id,
            "unit_code": "MTC-L12-Full",
            "floor": "Tầng 12",
            "area": 450.0,
            "rental_price": 28.0,
            "currency": "USD",
            "price_unit": "m2/tháng",
            "management_fee": "5 USD/m2/tháng",
            "extra_fees": "Điện máy lạnh theo công tơ, VAT 10%",
            "availability_status": "UPCOMING",
            "available_from": "Sẵn sàng bàn giao từ 01/11/2026",
            "notes": "Nguyên sàn riêng tư, lối đi riêng, view toàn cảnh trung tâm TP.HCM.",
            "status": "ACTIVE",
            "display_order": 3,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db["workspace_office_units"].insert_many(units_b1)

    # Building 2: Maian Financial Tower (Quận 1)
    b2_res = await db["workspace_office_buildings"].insert_one({
        "name": "Maian Financial Tower",
        "slug": "maian-financial-tower",
        "code": "BLD_MFT_02",
        "address": "Số 18 Đường Nguyễn Du, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        "district": "Quận 1",
        "city": "TP. Hồ Chí Minh",
        "building_grade": "A",
        "total_floors": "25 tầng nổi, 3 tầng hầm",
        "description": "Tòa cao ốc văn phòng hạng A chuẩn quốc tế tọa lạc ngay trung tâm tài chính Quận 1. Không gian làm việc đẳng cấp cho các tập đoàn đa quốc gia và tổ chức tài chính hàng đầu.",
        "highlights": [
            "Trái tim tài chính Quận 1 – liền kề Nhà hát Thành phố và phố đi bộ",
            "Tiêu chuẩn xây dựng xanh LEED Gold thân thiện môi trường",
            "Hệ thống an ninh thẻ từ phân tầng và nhận diện khuôn mặt AI",
        ],
        "amenities": [
            "6 thang máy tốc độ cao 4.0m/s",
            "Phòng họp hội nghị quốc tế sức chứa 150 người",
            "Sảnh đón khách VIP chuẩn khách sạn 5 sao",
            "Bãi đỗ xe thông minh 3 tầng hầm",
        ],
        "images": [
            {"id": "b2-img-1", "url": "/images/office/building-2.jpg", "alt_text": "Tòa nhà Maian Financial Tower Quận 1", "is_primary": True, "display_order": 1},
        ],
        "map_embed_url": "",
        "directions_url": "https://maps.google.com/?q=18+Nguyễn+Du,+Bến+Nghé,+Quận+1,+TP.HCM",
        "contact_phone": "0901 234 567",
        "contact_email": "leasing@maianhomes.vn",
        "status": "PUBLISHED",
        "version": 1,
        "published_version": 1,
        "display_order": 2,
        "seo_metadata": {
            "title": "Maian Financial Tower | Cho Thuê Văn Phòng Hạng A Quận 1 – Maian Homes",
            "description": "Cho thuê văn phòng cao cấp Maian Financial Tower tại Quận 1. Diện tích 120m2 - 680m2, tiêu chuẩn quốc tế, vị trí kim cương.",
            "canonical_url": "https://maianhomes.vn/dich-vu-cho-thue/office/maian-financial-tower",
            "robots": "index, follow",
            "og_title": "Cho Thuê Văn Phòng Hạng A Maian Financial Tower Quận 1",
            "og_description": "Văn phòng chuẩn quốc tế vị trí trung tâm Quận 1.",
            "og_image": "/images/office/building-2.jpg",
            "focus_keyword": "cho thuê văn phòng quận 1",
            "h1": "Cho Thuê Văn Phòng Maian Financial Tower",
        },
        "created_at": now,
        "updated_at": now,
    })
    b2_id = str(b2_res.inserted_id)

    # Units for Building 2
    units_b2 = [
        {
            "building_id": b2_id,
            "unit_code": "MFT-L15-01",
            "floor": "Tầng 15",
            "area": 220.0,
            "rental_price": 38.0,
            "currency": "USD",
            "price_unit": "m2/tháng",
            "management_fee": "6.5 USD/m2/tháng",
            "extra_fees": "Điện máy lạnh trong giờ hành chính đã bao gồm trong phí quản lý",
            "availability_status": "AVAILABLE",
            "available_from": "Bàn giao ngay",
            "notes": "Mặt bằng hoàn thiện trần sàn cao cấp, hướng nhìn sông Sài Gòn tuyệt đẹp.",
            "status": "ACTIVE",
            "display_order": 1,
            "created_at": now,
            "updated_at": now,
        },
        {
            "building_id": b2_id,
            "unit_code": "MFT-L20-02",
            "floor": "Tầng 20",
            "area": 350.0,
            "rental_price": 40.0,
            "currency": "USD",
            "price_unit": "m2/tháng",
            "management_fee": "6.5 USD/m2/tháng",
            "extra_fees": "VAT 10%",
            "availability_status": "UPCOMING",
            "available_from": "Bàn giao từ 15/10/2026",
            "notes": "Sàn tầng cao view landmark, phù hợp làm trụ sở tổng công ty.",
            "status": "ACTIVE",
            "display_order": 2,
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db["workspace_office_units"].insert_many(units_b2)

    # 6. Seed FAQs
    await db["workspace_faqs"].delete_many({})
    faqs_data = [
        # Coworking FAQs
        {
            "entity_type": "COWORKING",
            "entity_id": "singleton_location",
            "question": "Co-working Space có những loại chỗ ngồi nào?",
            "answer": "Maian Homes cung cấp hai hình thức chính: Chỗ ngồi linh hoạt (Hot Desk - bạn có thể chọn bất kỳ chỗ ngồi tự do nào trong khu vực mở) và Chỗ ngồi cố định (Dedicated Desk - bàn làm việc cá nhân của riêng bạn có khóa hộc tủ bảo mật).",
            "display_order": 1,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "COWORKING",
            "entity_id": "singleton_location",
            "question": "Có thể thuê chỗ ngồi làm việc theo ngày không?",
            "answer": "Có. Chúng tôi cung cấp gói thuê theo ngày linh hoạt (150.000 đ/ngày) với đầy đủ tiện ích như wifi tốc độ cao, nước uống và trà tại pantry mà không cần cam kết thời hạn dài.",
            "display_order": 2,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "COWORKING",
            "entity_id": "singleton_location",
            "question": "Giá thuê đã bao gồm những tiện ích gì?",
            "answer": "Giá thuê đã bao gồm trọn gói: internet cáp quang tốc độ cao, điện, điều hòa mát lạnh, nước uống tinh khiết & trà tại pantry, dịch vụ vệ sinh hàng ngày, tiếp nhận bưu phẩm thư từ và quyền sử dụng phòng họp theo hạn mức của từng gói thuê.",
            "display_order": 3,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "COWORKING",
            "entity_id": "singleton_location",
            "question": "Có thể đăng ký tham quan không gian trước khi thuê không?",
            "answer": "Hoàn toàn được! Bạn có thể nhấn nút 'Đăng ký tham quan' trên website hoặc gọi hotline 0901 234 567 để chuyên viên sắp xếp lịch đón tiếp và trải nghiệm thực tế không gian làm việc.",
            "display_order": 4,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "COWORKING",
            "entity_id": "singleton_location",
            "question": "Thời gian hoạt động của Co-working Space là gì?",
            "answer": "Không gian làm việc mở cửa từ 08:00 đến 21:00 từ Thứ 2 đến Thứ 7 hàng tuần (nghỉ Chủ Nhật và các ngày Lễ, Tết theo quy định).",
            "display_order": 5,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        # Office Landing FAQs
        {
            "entity_type": "OFFICE_LANDING",
            "entity_id": "office_landing",
            "question": "Quy trình tư vấn và thuê văn phòng tại Maian Homes diễn ra như thế nào?",
            "answer": "Quy trình gồm 4 bước tinh gọn: 1. Tiếp nhận nhu cầu (diện tích, ngân sách, khu vực); 2. Gửi danh sách báo giá chi tiết các tòa nhà phù hợp trong 2 giờ; 3. Tổ chức đưa đón khảo sát văn phòng thực tế miễn phí; 4. Hỗ trợ đàm phán hợp đồng thuê và các điều khoản miễn phí tiền thuê trong thời gian fit-out.",
            "display_order": 1,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "OFFICE_LANDING",
            "entity_id": "office_landing",
            "question": "Khách hàng thuê văn phòng có phải trả phí môi giới không?",
            "answer": "Không. Dịch vụ tư vấn, khảo sát mặt bằng và đàm phán hợp đồng thuê văn phòng tại Maian Homes là hoàn toàn MIỄN PHÍ 100% dành cho doanh nghiệp thuê.",
            "display_order": 2,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        # Building 1 FAQs
        {
            "entity_type": "BUILDING",
            "entity_id": b1_id,
            "question": "Tòa nhà Maian Tower Central hiện có những diện tích nào đang trống?",
            "answer": "Tòa nhà hiện đang có diện tích 85m² (Tầng 4), 160m² (Tầng 8) có thể bàn giao ngay và diện tích nguyên sàn 450m² (Tầng 12) sắp trống trong tháng tới.",
            "display_order": 1,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
        {
            "entity_type": "BUILDING",
            "entity_id": b1_id,
            "question": "Giá thuê tại Maian Tower Central đã bao gồm phí quản lý chưa?",
            "answer": "Giá thuê chưa bao gồm phí quản lý ($5/m²/tháng) và thuế VAT 10%. Phí quản lý đã bao gồm điện điều hòa trong giờ hành chính, bảo vệ an ninh, vệ sinh khu vực chung.",
            "display_order": 2,
            "status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db["workspace_faqs"].insert_many(faqs_data)

    logger.info("Workspace Solutions database seed completed successfully!")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_workspace_data())
