import asyncio
import json
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.abspath("."))
from fastapi import Request
from app.api.protected.ai import (
    SEORequest,
    ArticleSEOGEORequest,
    SEOSourceInput,
    generate_project_seo,
    generate_article_seo_geo,
)
from app.db.mongodb import connect_to_mongo

async def run_verification():
    print("=== BẮT ĐẦU KIỂM TRA CHỨC NĂNG AI SEO / GEO ===")
    await connect_to_mongo()
    
    mock_request = Request({
        "type": "http",
        "method": "POST",
        "path": "/api/protected/ai/seo",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    })
    mock_user = {"email": "admin@maianhomes.vn", "role": "ADMIN", "permissions": ["website.projects.update", "website.articles.update"]}

    # 1. Kiểm tra Guardrail 1: Dự án chưa đủ 100 ký tự
    print("\n--- TEST 1: Guardrail Dự án dưới 100 ký tự ---")
    short_project = SEORequest(
        project_name="Dự án Nhỏ",
        description="Mô tả quá ngắn.",
        location="TP.HCM",
    )
    res_short = await generate_project_seo(mock_request, short_project, mock_user)
    print(f"Status: {res_short['status']}")
    print(f"Warnings: {res_short.get('warnings')}")
    assert res_short['status'] == 'needs_input'
    assert res_short['warnings'][0]['code'] == 'PROJECT_EVIDENCE_REQUIRED'
    print("-> PASS: Guardrail dự án hoạt động chính xác (chặn dữ liệu < 100 ký tự).")

    # 2. Kiểm tra Guardrail 2: Bài viết thị trường thiếu nguồn tham khảo
    print("\n--- TEST 2: Guardrail Bài viết thị trường thiếu nguồn ---")
    market_article_no_source = ArticleSEOGEORequest(
        title="Dự báo thị trường căn hộ cao cấp khu Đông TP.HCM 2026",
        sapo="Thị trường căn hộ cao cấp tại TP.HCM tiếp tục duy trì mức tăng trưởng ấn tượng với tỷ lệ hấp thụ đạt mức kỷ lục trong quý vừa qua.",
        slug="du-bao-thi-truong-can-ho-cao-cap-2026",
        category="market",
        content="<p>Theo báo cáo mới nhất, phân khúc bất động sản cao cấp tại TP. Thủ Đức đang dẫn dắt thị trường nhờ hạ tầng đồng bộ và nguồn cung khan hiếm. Nhiều dự án trọng điểm đang bước vào giai đoạn bàn giao với tỷ lệ cư dân về ở đạt mức cao.</p>",
        sources=[],
    )
    res_no_source = await generate_article_seo_geo(mock_request, market_article_no_source, mock_user)
    print(f"Status: {res_no_source['status']}")
    print(f"Warnings: {res_no_source.get('warnings')}")
    assert res_no_source['status'] == 'needs_input'
    assert res_no_source['warnings'][0]['code'] == 'SOURCE_REQUIRED'
    print("-> PASS: Guardrail bài viết thị trường hoạt động chính xác (bắt buộc nguồn kiểm chứng).")

    # 3. Kiểm tra LIVE AI Tạo SEO/GEO cho Dự án đầy đủ dữ liệu
    print("\n--- TEST 3: Tạo SEO/GEO cho Dự án Bất động sản (LIVE AI) ---")
    full_project = SEORequest(
        project_name="The Privé",
        description="The Privé là khu phức hợp căn hộ hạng sang tọa lạc tại vị trí đắc địa phường An Phú, TP. Thủ Đức. Dự án sở hữu kiến trúc hiện đại, tầm nhìn trực diện sông Sài Gòn, mang lại không gian sống sinh thái trong lành cùng cộng đồng cư dân tinh hoa bậc nhất khu Đông.",
        location="Phường An Phú, TP. Thủ Đức, TP. Hồ Chí Minh",
        developer="Tập đoàn An Gia Khang phối hợp cùng Maian Homes phân phối chính thức",
        status="PRE_SALE",
        price_range="Từ 85 triệu/m2",
        amenities=[
            "Hồ bơi vô cực điện phân muối tầng 30",
            "Công viên nhiệt đới ven sông 1.5 ha",
            "Phòng tập Gym & Yoga công nghệ Technogym",
            "Sảnh đón chuẩn khách sạn 5 sao",
            "Trung tâm thương mại và ẩm thực nội khu",
        ],
        marketing_tags=["Căn hộ hạng sang", "Ven sông Sài Gòn", "Thủ Đức", "Pháp lý hoàn chỉnh"],
    )
    
    t0 = asyncio.get_event_loop().time()
    res_project = await generate_project_seo(mock_request, full_project, mock_user)
    t1 = asyncio.get_event_loop().time()
    
    print(f"Thời gian tạo sinh: {round(t1 - t0, 2)} giây")
    print(f"Status: {res_project['status']}")
    print(f"Model sử dụng: {res_project['generation']['model']}")
    print(f"Prompt Version: {res_project['generation']['prompt_version']}")
    
    data = res_project.get("data")
    if data:
        print("\n[KẾT QUẢ SEO DỰ ÁN TẠO THÀNH CÔNG]:")
        print(f"- Title (SEO): {data.get('title')}")
        print(f"- Meta Description: {data.get('description')}")
        print(f"- Focus Keyword: {data.get('focus_keyword')}")
        print(f"- Keywords: {', '.join(data.get('keywords', []))}")
        print(f"- USPs (Điểm nổi bật): {data.get('usps')}")
        print(f"- Key Facts ({len(data.get('key_facts', []))} dữ kiện): {data.get('key_facts')[:2]}...")
        print(f"- FAQs ({len(data.get('faqs', []))} câu hỏi): {data.get('faqs')[:1]}...")
        print(f"- Cornerstone Text: {data.get('cornerstone_text')[:120]}...")
        assert res_project['status'] == 'ok'
        assert data.get('title') is not None
        assert data.get('focus_keyword') is not None
        print("-> PASS: Tạo SEO/GEO dự án bằng AI thành công mỹ mãn!")
    else:
        print(f"Data is None, warnings: {res_project.get('warnings')}")
        sys.exit(1)

    # 4. Kiểm tra LIVE AI Tạo SEO/GEO cho Bài viết tin tức đầy đủ
    print("\n--- TEST 4: Tạo SEO/GEO cho Bài viết Tin tức / Thị trường (LIVE AI) ---")
    full_article = ArticleSEOGEORequest(
        title="Xu hướng chọn căn hộ ven sông tại khu Đông TP.HCM năm 2026",
        sapo="Bất động sản ven sông tại TP. Thủ Đức đang trở thành tâm điểm thu hút dòng vốn đầu tư và khách mua ở thực nhờ không gian sống sinh thái và tiềm năng gia tăng giá trị bền vững.",
        slug="xu-huong-can-ho-ven-song-khu-dong-2026",
        category="market",
        content="""
        <p>Báo cáo thị trường bất động sản quý 1 năm 2026 chỉ ra rằng các sản phẩm căn hộ ven sông có tốc độ tăng giá trung bình cao hơn 15% so với các dự án thông thường cùng khu vực. Môi trường trong lành, tầm nhìn khoáng đạt và hạ tầng kết nối là những yếu tố then chốt thúc đẩy người mua lựa chọn.</p>
        <p>Khu vực An Phú, Thảo Điền và Thủ Thiêm tiếp tục là tâm điểm của dòng sản phẩm cao cấp. Dự án The Privé với vị trí ven sông Sài Gòn đang nhận được sự quan tâm lớn từ cả chuyên gia nước ngoài và gia đình trẻ thành đạt.</p>
        <p>Các chuyên gia nhận định nguồn cung ven sông ngày càng giới hạn do quỹ đất ven sông không còn nhiều, khiến các dự án đã hoàn chỉnh pháp lý trở thành tài sản tích sản đắt giá trong dài hạn.</p>
        """,
        sources=[
            SEOSourceInput(
                title="Báo cáo Thị trường Bất động sản Việt Nam 2026",
                url="https://maianhomes.vn/nghien-cuu-thi-truong/bao-cao-2026",
                publisher="Viện Nghiên cứu Bất động sản Maian",
            )
        ],
    )
    
    t0 = asyncio.get_event_loop().time()
    res_article = await generate_article_seo_geo(mock_request, full_article, mock_user)
    t1 = asyncio.get_event_loop().time()
    
    print(f"Thời gian tạo sinh: {round(t1 - t0, 2)} giây")
    print(f"Status: {res_article['status']}")
    print(f"Model sử dụng: {res_article['generation']['model']}")
    
    art_data = res_article.get("data")
    if art_data:
        print("\n[KẾT QUẢ SEO BÀI VIẾT TẠO THÀNH CÔNG]:")
        print(f"- Meta Title (SEO): {art_data.get('meta_title')}")
        print(f"- Meta Description: {art_data.get('meta_description')}")
        print(f"- Focus Keyword: {art_data.get('focus_keyword')}")
        print(f"- Keywords: {', '.join(art_data.get('keywords', []))}")
        print(f"- Answer Summary: {art_data.get('answer_summary')}")
        print(f"- Canonical URL: {art_data.get('canonical_url')}")
        print(f"- Internal Links: {art_data.get('internal_links')}")
        print(f"- Key Facts ({len(art_data.get('key_facts', []))} dữ kiện): {art_data.get('key_facts')[:2]}...")
        assert res_article['status'] == 'ok'
        assert art_data.get('meta_title') is not None
        print("-> PASS: Tạo SEO/GEO bài viết bằng AI thành công mỹ mãn!")
    else:
        print(f"Data is None, warnings: {res_article.get('warnings')}")
        sys.exit(1)

    print("\n=======================================================")
    print("TẤT CẢ 4 BƯỚC KIỂM TRA CHỨC NĂNG AI SEO/GEO ĐÃ HOÀN TẤT XUẤT SẮC!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
