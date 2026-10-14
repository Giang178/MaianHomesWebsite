import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('Thực hiện thao tác tạo đầy đủ dự án và bài viết qua giao diện', () => {
  test.use({
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
  });

  test('Tạo dự án và bài viết để kiểm tra lỗi trên giao diện', async ({ page }) => {
    test.setTimeout(180000);
    test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL và E2E_ADMIN_PASSWORD phải được cấp qua CI secrets.');

    const consoleLogs: string[] = [];
    const failedRequests: string[] = [];
    const toasts: string[] = [];

    page.on('console', msg => {
      const txt = msg.text();
      if (msg.type() === 'error' || txt.toLowerCase().includes('error')) {
        consoleLogs.push(`[Console ${msg.type()}] ${txt}`);
      }
    });

    page.on('response', async resp => {
      if (resp.status() >= 400) {
        let respBody = '';
        try {
          respBody = await resp.text();
        } catch {
          respBody = '(could not read body)';
        }
        failedRequests.push(`[HTTP ${resp.status()}] ${resp.request().method()} ${resp.url()} -> ${respBody.slice(0, 300)}`);
      }
    });

    // ==========================================
    // BƯỚC 1: ĐĂNG NHẬP ADMIN
    // ==========================================
    console.log('=== BƯỚC 1: ĐĂNG NHẬP ADMIN ===');
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    await page.locator('input[type="email"]').fill(adminEmail!);
    await page.locator('input[type="password"]').fill(adminPassword!);
    await page.getByRole('button', { name: /VÀO HỆ THỐNG/i }).click();

    await page.waitForURL('**/admin**', { timeout: 15000 });
    console.log('-> Đăng nhập thành công! URL hiện tại:', page.url());
    await page.waitForTimeout(1000);

    // ==========================================
    // BƯỚC 2: TẠO DỰ ÁN MỚI
    // ==========================================
    console.log('=== BƯỚC 2: MỞ QUẢN LÝ DỰ ÁN VÀ TẠO DỰ ÁN ===');
    await page.goto('/admin/projects');
    await page.waitForSelector('h1, h2, button', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const initialProjectCount = await page.locator('tbody tr').count();
    console.log('-> Số lượng dự án ban đầu trong bảng:', initialProjectCount);

    const createProjectBtn = page.getByRole('button', { name: /Thêm dự án mới/i }).or(page.getByRole('button', { name: /Thêm dự án|Tạo dự án|Tạo mới/i })).first();
    await expect(createProjectBtn).toBeVisible({ timeout: 10000 });
    console.log('-> Đã tìm thấy nút tạo dự án. Nhấn nút...');
    await createProjectBtn.click();

    await page.waitForSelector('.mkt-fullscreen-overlay, [role="dialog"]', { timeout: 10000 });
    console.log('-> Đã mở trình soạn thảo dự án (Project Editor).');
    await page.waitForTimeout(1000);

    // --- TAB 0: TỔNG QUAN ---
    console.log('-> Đang điền Tab 0 (Tổng quan: Tên, Slug, CĐT)...');
    const projectName = `Dự Án Biệt Thự Maian Riverside Oasis ${Date.now()}`;
    const projectSlug = `du-an-biet-thu-maian-riverside-oasis-${Date.now()}`;

    const nameInput = page.locator('input[data-field="name"]').or(page.locator('input[placeholder*="tên dự án" i]')).first();
    await nameInput.fill(projectName);

    const slugInput = page.locator('input[data-field="slug"]').or(page.locator('input[placeholder*="slug" i]')).first();
    if (await slugInput.isVisible()) {
      await slugInput.fill(projectSlug);
    }

    const devInput = page.locator('input[data-field="developer"]').or(page.locator('input[placeholder*="chủ đầu tư" i]')).first();
    if (await devInput.isVisible()) {
      await devInput.fill('Tập đoàn Bất động sản Mai An Homes');
    }

    // --- TAB 2: TỔNG QUAN & QUY MÔ / GIÁ & MÔ TẢ ---
    console.log('-> Chuyển sang Tab Tổng quan & Quy mô...');
    const tabPriceDesc = page.locator('.mkt-stepper-item').filter({ hasText: /Tổng quan & Quy mô/i }).first();
    if (await tabPriceDesc.isVisible()) {
      await tabPriceDesc.click();
      await page.waitForTimeout(500);

      const descTextarea = page.locator('textarea[data-field="description"]').or(page.locator('textarea').first());
      if (await descTextarea.isVisible()) {
        await descTextarea.fill('Dự án biệt thự sinh thái cao cấp ven sông Sài Gòn với phong cách kiến trúc nhiệt đới hiện đại, không gian cảnh quan xanh mát và bến du thuyền 5 sao đẳng cấp quốc tế.');
      }

      const priceInput = page.locator('input[data-field="price"]').or(page.locator('input[placeholder*="giá" i]')).first();
      if (await priceInput.isVisible()) {
        await priceInput.fill('15 - 45 Tỷ VNĐ');
      }
    }

    // --- TAB 3: VỊ TRÍ & BẢN ĐỒ ---
    console.log('-> Chuyển sang Tab Vị trí & Bản đồ...');
    const tabLocation = page.locator('.mkt-stepper-item').filter({ hasText: /Vị trí & Bản đồ/i }).first();
    if (await tabLocation.isVisible()) {
      await tabLocation.click();
      await page.waitForTimeout(500);

      const locInput = page.locator('input[data-field="location"]').or(page.locator('input[placeholder*="địa chỉ" i]')).first();
      if (await locInput.isVisible()) {
        await locInput.fill('Số 88 Bến Vân Đồn, Phường 12, Quận 4, TP.HCM');
      }

      const locDesc = page.locator('textarea[data-field="location_description"]').first();
      if (await locDesc.isVisible()) {
        await locDesc.fill('Tọa lạc ngay mặt tiền Bến Vân Đồn, kết nối nhanh chóng đến trung tâm Quận 1 chỉ qua cầu Calmette và cầu Khánh Hội.');
      }
    }

    // --- TAB 7: LIÊN HỆ & PHÁP LÝ ---
    console.log('-> Chuyển sang Tab Liên hệ & Pháp lý...');
    const tabContact = page.locator('.mkt-stepper-item').filter({ hasText: /Liên hệ & Pháp lý/i }).first();
    if (await tabContact.isVisible()) {
      await tabContact.click();
      await page.waitForTimeout(500);

      const phoneInput = page.locator('input[data-field="contact_phone"]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('0969105059');
      }

      const emailInput = page.locator('input[data-field="contact_email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('maianhomes.vn@gmail.com');
      }
    }

    // --- TAB 9: KIỂM SOÁT SEO/GEO ---
    console.log('-> Chuyển sang Tab Kiểm soát SEO/GEO...');
    const tabSeoGeo = page.locator('.mkt-stepper-item').filter({ hasText: /Kiểm soát SEO\/GEO/i }).first();
    if (await tabSeoGeo.isVisible()) {
      await tabSeoGeo.click();
      await page.waitForTimeout(500);

      const seoTitleInput = page.locator('input[data-field="seo_metadata.title"]').first();
      if (await seoTitleInput.isVisible()) {
        await seoTitleInput.fill('Biệt Thự Maian Riverside Oasis Quận 4 TP.HCM');
      }

      const seoDescInput = page.locator('textarea[data-field="seo_metadata.description"]').first();
      if (await seoDescInput.isVisible()) {
        await seoDescInput.fill('Biệt thự cao cấp Maian Riverside Oasis Quận 4 TP.HCM sở hữu vị trí ven sông đắt giá, bến du thuyền riêng và không gian sống thượng lưu chuẩn 5 sao.');
      }

      const focusKwInput = page.locator('input[data-field="seo_metadata.focus_keyword"]').first();
      if (await focusKwInput.isVisible()) {
        await focusKwInput.fill('biet thu maian riverside oasis');
      }

      const cornerstoneInput = page.locator('textarea[data-field="seo_metadata.cornerstone_text"]').first();
      if (await cornerstoneInput.isVisible()) {
        await cornerstoneInput.fill('Maian Riverside Oasis là tổ hợp biệt thự và dinh thự ven sông biệt lập tại Bến Vân Đồn mang lại không gian sống thượng lưu chuẩn mực và bền vững.');
      }
    }

    // Nhấn nút Lưu bản nháp dự án
    console.log('-> Nhấn nút [Lưu bản nháp dự án]...');
    const saveProjectBtn = page.getByRole('button', { name: /Lưu bản nháp dự án|Lưu dự án/i }).first();
    await expect(saveProjectBtn).toBeVisible();
    await saveProjectBtn.click();

    await page.waitForTimeout(3000);

    const alertElements = await page.locator('[role="alert"], [aria-live="polite"], .toast, .bg-rose-900, .bg-emerald-900').allInnerTexts();
    if (alertElements.length > 0) {
      console.log('-> Thông báo phản hồi Dự án:', alertElements.join(' | '));
      toasts.push(...alertElements);
    }

    // Đóng modal dự án nếu còn mở
    const closeProjectModal = page.getByRole('button', { name: /Thoát trình tạo dự án|Đóng/i }).first();
    if (await closeProjectModal.isVisible()) {
      await closeProjectModal.click();
      await page.waitForTimeout(1000);
    }

    // ==========================================
    // BƯỚC 3: TẠO BÀI VIẾT MỚI
    // ==========================================
    console.log('=== BƯỚC 3: MỞ QUẢN LÝ BÀI VIẾT VÀ TẠO BÀI VIẾT ===');
    await page.goto('/admin/articles');
    await page.waitForSelector('h1, h2, button', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const createArticleBtn = page.getByRole('button', { name: /Viết Bài Mới|Viết bài|Tạo bài viết/i }).first();
    await expect(createArticleBtn).toBeVisible({ timeout: 10000 });
    console.log('-> Đã tìm thấy nút tạo bài viết mới. Nhấn nút...');
    await createArticleBtn.click();

    // Chờ màn hình soạn thảo bài viết mở
    const modalNav = page.getByRole('navigation', { name: 'Các bước bài viết' });
    await expect(modalNav).toBeVisible({ timeout: 15000 });
    console.log('-> Đã mở trình soạn thảo bài viết (Article Editor).');
    await page.waitForTimeout(1000);

    // --- BƯỚC 1: NỘI DUNG & BIÊN TẬP ---
    console.log('-> Điền Bước 1 (Nội dung: Tiêu đề, Sapo, Bài viết)...');
    const articleTitle = `Thị Trường Bất Động Sản Ven Sông TP.HCM Bứt Phá Năm 2026 ${Date.now()}`;
    const artTitleInput = page.locator('input[placeholder*="VD: Maian Homes chính thức ra mắt" i]').first();
    await expect(artTitleInput).toBeVisible();
    await artTitleInput.fill(articleTitle);

    const artSapoTextarea = page.locator('textarea[placeholder*="Tóm tắt nội dung chính theo nguyên tắc 5W1H" i]').first();
    if (await artSapoTextarea.isVisible()) {
      await artSapoTextarea.fill('Các dự án bất động sản ven sông tại TP.HCM tiếp tục ghi nhận thanh khoản ấn tượng nhờ sở hữu không gian sinh thái mát mẻ và tiềm năng gia tăng giá trị dài hạn cho giới đầu tư tinh hoa.');
    }

    // Điền nội dung bài viết
    const richEditor = page.locator('.tiptap, [contenteditable="true"]').first();
    if (await richEditor.isVisible()) {
      await richEditor.click();
      await richEditor.fill('Theo các chuyên gia quy hoạch và tài chính, bất động sản ven sông luôn là tài sản định danh đẳng cấp của giới đầu tư. Nguồn cung khan hiếm càng thúc đẩy giá trị bất động sản gia tăng theo thời gian. Sự xuất hiện của các dự án chuẩn mực cao cấp ven sông Sài Gòn đang tạo nên làn sóng mới cho thị trường trong năm 2026 với tỷ lệ hấp thụ đạt mức kỷ lục. Xu hướng này phản ánh sự chuyển dịch rõ rệt của khách hàng thượng lưu về nhu cầu sống xanh và an yên.');
    }

    // --- BƯỚC 3: SEO GOOGLE & SERP ---
    console.log('-> Chuyển sang Bước 3: SEO Google & SERP...');
    const stepSeoBtn = modalNav.getByRole('button', { name: /SEO Google & SERP/i });
    if (await stepSeoBtn.isVisible()) {
      await stepSeoBtn.click();
      await page.waitForTimeout(500);

      const artMetaTitle = page.locator('input[placeholder*="tiêu đề chuẩn SEO" i]').or(page.locator('input[placeholder*="tiêu đề SEO" i]')).first();
      if (await artMetaTitle.isVisible()) {
        await artMetaTitle.fill('Bất Động Sản Ven Sông TP.HCM Bứt Phá Năm 2026');
      }

      const artMetaDesc = page.locator('textarea[placeholder*="mô tả chuẩn SEO" i]').or(page.locator('textarea[placeholder*="mô tả SEO" i]')).first();
      if (await artMetaDesc.isVisible()) {
        await artMetaDesc.fill('Phân tích toàn diện thị trường bất động sản ven sông tại TP.HCM năm 2026 với những dự báo về nguồn cung, giá bán và cơ hội đầu tư sinh lời bền vững.');
      }

      const artFocusKw = page.locator('input[placeholder*="từ khóa" i]').first();
      if (await artFocusKw.isVisible()) {
        await artFocusKw.fill('bds ven song tphcm 2026');
      }
    }

    // --- BƯỚC 4: GEO & TRÍCH DẪN AI ---
    console.log('-> Chuyển sang Bước 4: GEO & Trích dẫn AI...');
    const stepGeoBtn = modalNav.getByRole('button', { name: /GEO & Trích dẫn AI/i });
    if (await stepGeoBtn.isVisible()) {
      await stepGeoBtn.click();
      await page.waitForTimeout(500);

      const artAnswerSummary = page.locator('textarea[placeholder*="tóm tắt" i]').first();
      if (await artAnswerSummary.isVisible()) {
        await artAnswerSummary.fill('Thị trường bất động sản ven sông TP.HCM năm 2026 tiếp tục duy trì vị thế dẫn đầu phân khúc hạng sang nhờ vị trí đắc địa và khan hiếm nguồn cung.');
      }
    }

    // Nhấn Lưu / Tạo bản nháp bài viết
    console.log('-> Nhấn nút [Tạo Bản Nháp] / [Lưu bài viết]...');
    const saveArticleBtn = page.getByRole('button', { name: /Tạo Bản Nháp|Lưu bài viết|Lưu nháp/i }).first();
    if (await saveArticleBtn.isVisible()) {
      await saveArticleBtn.click();
      await page.waitForTimeout(3000);
    }

    const articleAlerts = await page.locator('[role="alert"], [aria-live="polite"], .toast').allInnerTexts();
    if (articleAlerts.length > 0) {
      console.log('-> Thông báo phản hồi Bài viết:', articleAlerts.join(' | '));
      toasts.push(...articleAlerts);
    }

    // Thoát trình soạn thảo bài viết
    const closeArticleBtn = page.getByRole('button', { name: /Đóng \/ Thoát/i }).first();
    if (await closeArticleBtn.isVisible()) {
      await closeArticleBtn.click();
      await page.waitForTimeout(1000);
    }

    // Kiểm tra danh sách bài viết đã có dữ liệu chưa
    console.log('-> Kiểm tra danh sách bài viết sau khi tạo...');
    await page.goto('/admin/articles');
    await page.waitForTimeout(2000);
    const articleRows = await page.locator('tbody tr').count();
    console.log('-> Số lượng dòng bài viết trong bảng:', articleRows);

    console.log('=== KẾT QUẢ KIỂM TRA TOÀN DIỆN ===');
    console.log('Toasts / Alerts xuất hiện:', JSON.stringify(toasts));
    console.log('Số lỗi mạng failedRequests (>= 400):', failedRequests.length);
    failedRequests.forEach(req => console.log('  ', req));
    console.log('Số console error logs:', consoleLogs.length);
    consoleLogs.forEach(log => console.log('  ', log));
  });
});
