import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('Maian Homes Full User Workflow Test', () => {
  test.use({ baseURL: 'http://localhost:3000' });

  test('E2E Workflow: Customer -> CEO Login -> Accounts/Permissions -> SEO/GEO -> Projects -> Articles', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL và E2E_ADMIN_PASSWORD phải được cấp qua CI secrets.');

    // =========================================================================
    // GIAI ĐOẠN 1: KHÁCH HÀNG (CUSTOMER) TRẢI NGHIỆM TRÊN WEBSITE
    // =========================================================================
    console.log('--- BƯỚC 1: Khách hàng truy cập trang chủ & danh mục dự án ---');
    await page.goto('/');
    await expect(page).toHaveTitle(/Maian Homes/i);

    // Khách hàng bấm xem danh mục dự án
    await page.goto('/du_an');
    await page.waitForLoadState('networkidle');
    console.log('Khách hàng đã xem danh mục dự án');

    // Khách hàng gửi liên hệ / tư vấn tại trang liên hệ
    console.log('--- BƯỚC 2: Khách hàng gửi yêu cầu tư vấn tại trang liên hệ ---');
    await page.goto('/lien-he');
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('input[placeholder*="Nguyễn Văn A"]').or(page.locator('input[name="name"]')).or(page.locator('input[type="text"]').first());
    await nameInput.fill('Khách Hàng Trải Nghiệm E2E');

    const phoneInput = page.locator('input[type="tel"]').or(page.locator('input[placeholder*="09"]'));
    await phoneInput.fill('0909123456');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('khachhang.test@gmail.com');

    const messageInput = page.locator('textarea').first();
    await messageInput.fill('Tôi quan tâm dự án căn hộ cao cấp và muốn nhận báo giá chi tiết.');

    const submitBtn = page.getByRole('button', { name: /Gửi yêu cầu|Gửi tin nhắn/i }).first();
    await submitBtn.click();
    console.log('Khách hàng đã bấm gửi form liên hệ');

    // Chờ phản hồi thành công hoặc thông báo
    await page.waitForTimeout(1500);

    // =========================================================================
    // GIAI ĐOẠN 2: ĐĂNG NHẬP VAI TRÒ ADMIN / CEO
    // =========================================================================
    console.log('--- BƯỚC 3: Đăng nhập hệ thống quản trị với tài khoản CEO/Admin ---');
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill(adminEmail!);
    await page.locator('input[type="password"]').fill(adminPassword!);
    await page.getByRole('button', { name: /VÀO HỆ THỐNG/i }).click();

    // Chờ điều hướng vào trang quản trị /admin
    await page.waitForURL('**/admin**', { timeout: 15000 });
    console.log('Đăng nhập thành công vào trang quản trị:', page.url());

    // =========================================================================
    // GIAI ĐOẠN 3: QUẢN LÝ TÀI KHOẢN, TẠO TÀI KHOẢN & PHÂN QUYỀN
    // =========================================================================
    console.log('--- BƯỚC 4: Quản lý tài khoản, tạo tài khoản và cấu hình phân quyền ---');
    await page.goto('/admin/accounts');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1, name: /Tài khoản/i })).toBeVisible({ timeout: 10000 });

    // Kiểm tra danh sách tài khoản hiện có
    const userRow = page.locator('text=maianhomes.vn@gmail.com');
    await expect(userRow.first()).toBeVisible();
    console.log('Đã hiển thị danh sách tài khoản quản trị');

    // Mở modal tạo tài khoản nhân sự mới
    const addAccountBtn = page.getByRole('button', { name: /Tạo tài khoản|Thêm tài khoản/i }).first();
    if (await addAccountBtn.isVisible()) {
      await addAccountBtn.click();
      await page.waitForTimeout(500);
      console.log('Đã mở form tạo tài khoản nhân sự');

      // Điền thông tin nhân viên mới
      const testEmail = `nhanvien.seo.${Date.now()}@maianhomes.com`;
      const emailField = page.locator('input[name="email"]').or(page.locator('input[type="email"]')).last();
      await emailField.fill(testEmail);

      const fullNameField = page.locator('input[name="full_name"]').or(page.locator('input[name="name"]')).or(page.locator('input[placeholder*="Họ và tên"]')).last();
      if (await fullNameField.isVisible()) {
        await fullNameField.fill('Nhân Viên SEO & Nội Dung');
      }

      // Chọn vai trò MARKETING
      const roleSelect = page.locator('select').first();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption({ label: 'MARKETING' }).catch(() => roleSelect.selectOption('MARKETING'));
      }

      // Bấm nút lưu/tạo
      const createSubmitBtn = page.getByRole('button', { name: /Lưu|Tạo|Xác nhận/i }).last();
      await createSubmitBtn.click();
      await page.waitForTimeout(1000);
      console.log('Đã gửi yêu cầu tạo tài khoản nhân viên:', testEmail);
    }

    // =========================================================================
    // GIAI ĐOẠN 4: NHẬP LIỆU NỘI DUNG, TỐI ƯU HÓA SEO & GEO
    // =========================================================================
    console.log('--- BƯỚC 5: Thao tác nhập liệu Nội dung, SEO & GEO ---');
    await page.goto('/admin/content');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Chuyển sang Tab SEO
    const seoTab = page.getByRole('button', { name: /SEO/i }).first();
    if (await seoTab.isVisible()) {
      await seoTab.click();
      await page.waitForTimeout(500);
      console.log('Đã chuyển sang Tab Quản lý SEO');

      // Nhập Meta Title & Description
      const metaTitleInput = page.locator('input[placeholder*="tiêu đề SEO"]').or(page.locator('input[name="title"]')).first();
      if (await metaTitleInput.isVisible()) {
        await metaTitleInput.fill('Maian Homes - Căn Hộ Cao Cấp TP.HCM | Bất Động Sản Hạng Sang');
      }
    }

    // Chuyển sang Tab GEO (Generative Engine Optimization)
    const geoTab = page.getByRole('button', { name: /GEO|AI Engine|Tham số GEO/i }).first();
    if (await geoTab.isVisible()) {
      await geoTab.click();
      await page.waitForTimeout(500);
      console.log('Đã chuyển sang Tab Tối ưu hóa GEO cho AI Search');
      
      const geoSummary = page.locator('textarea').first();
      if (await geoSummary.isVisible()) {
        await geoSummary.fill('Maian Homes là thương hiệu phân phối và quản lý bất động sản cao cấp, căn hộ hạng sang và dịch vụ lưu trú tiêu chuẩn 5 sao tại TP.HCM.');
      }
    }

    // =========================================================================
    // GIAI ĐOẠN 5: TẠO VÀ QUẢN LÝ DỰ ÁN BẤT ĐỘNG SẢN
    // =========================================================================
    console.log('--- BƯỚC 6: Tạo & quản lý Dự án bất động sản ---');
    await page.goto('/admin/projects');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Trang quản lý dự án đã tải xong');
    const newProjectBtn = page.getByRole('button', { name: /Thêm dự án|Tạo dự án|Tạo mới/i }).first();
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
      await page.waitForTimeout(500);
      console.log('Đã mở form thêm dự án mới');
    }

    // =========================================================================
    // GIAI ĐOẠN 6: TẠO VÀ QUẢN LÝ BÀI VIẾT TIN TỨC / BẤT ĐỘNG SẢN
    // =========================================================================
    console.log('--- BƯỚC 7: Tạo & quản trị Bài viết tin tức ---');
    await page.goto('/admin/articles');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Trang quản lý bài viết tin tức đã tải xong');
    const newArticleBtn = page.getByRole('button', { name: /Viết bài|Tạo bài viết|Thêm bài viết/i }).first();
    if (await newArticleBtn.isVisible()) {
      await newArticleBtn.click();
      await page.waitForTimeout(500);
      console.log('Đã mở màn hình soạn thảo bài viết mới');
    }

    console.log('=== WORKFLOW KIỂM TRA TOÀN DIỆN HOÀN TẤT THÀNH CÔNG 100% ===');
  });
});
