import {expect, test} from '@playwright/test';

const pages = [
  {path: '/lien-he', heading: /LIÊN HỆ MAIAN HOMES/i},
  {path: '/ky-gui', heading: /Ký gửi & Chuyển nhượng Bất Động Sản TP[.]HCM/i},
  {path: '/chinh-sach-bao-mat', heading: /Chính Sách Bảo Mật/i},
];

for (const publicPage of pages) {
  test(`${publicPage.path} renders without a browser runtime error`, async ({page}) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const response = await page.goto(publicPage.path, {waitUntil: 'domcontentloaded'});

    expect(response?.ok()).toBe(true);
    const expectedHeading = publicPage.path === '/ky-gui'
      ? /Ký gửi nhà đất với Maian Homes/i
      : publicPage.heading;
    await expect(page.getByRole('heading', {level: 1, name: expectedHeading})).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test('an expired employee session never redirects the public website', async ({page}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('maian_user', JSON.stringify({
      id: 'employee-account',
      email: 'staff@example.com',
      role: 'HR_STAFF',
      name: 'Staging Staff',
    }));
  });
  await page.route('**/api/public/auth/verify', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({detail: 'Session expired'}),
    });
  });

  const response = await page.goto('/lien-he', {waitUntil: 'domcontentloaded'});

  expect(response?.ok()).toBe(true);
  await expect(page.getByTestId('floating-contact-widget')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('maian_user'))).toBeNull();
  expect(new URL(page.url()).pathname).toBe('/lien-he');
});

test('one support launcher opens the embedded Zalo OA window and Mái Đỏ chat', async ({page}) => {
  await page.route('https://sp.zalo.me/plugins/sdk.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        let widgetReady = false;
        let readinessScheduled = false;
        const ensureWidgetFrame = () => {
          const host = document.querySelector('.zalo-chat-widget');
          if (!host) return null;
          let frame = host.querySelector('iframe');
          if (!frame) {
            frame = document.createElement('iframe');
            frame.setAttribute('height', '46');
            host.appendChild(frame);
          }
          return frame;
        };
        window.ZaloSocialSDK = {
          reload() {
            ensureWidgetFrame();
          },
          openChatWidget() {
            const frame = ensureWidgetFrame();
            if (!widgetReady) {
              if (!readinessScheduled) {
                readinessScheduled = true;
                window.setTimeout(() => {
                  widgetReady = true;
                  frame?.setAttribute('height', '70');
                  window.dispatchEvent(new MessageEvent('message', {
                    origin: 'https://page.widget.zalo.me',
                    data: {cmd: 'zchat_widget_close_chat_box', width: 70, height: 70}
                  }));
                }, 1_000);
              }
              return;
            }
            frame?.setAttribute('height', '420');
            window.dispatchEvent(new MessageEvent('message', {
              origin: 'https://page.widget.zalo.me',
              data: {cmd: 'zchat_widget_open_chat_box', width: 350, height: 420}
            }));
          },
          closeChatWidget() {
            ensureWidgetFrame()?.setAttribute('height', '70');
            window.dispatchEvent(new MessageEvent('message', {
              origin: 'https://page.widget.zalo.me',
              data: {cmd: 'zchat_widget_close_chat_box', width: 70, height: 70}
            }));
          }
        };
      `,
    });
  });
  await page.route('**/api/public/contact-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        phone: '0969105059',
        phone_href: 'tel:0969105059',
        zalo_oa_id: '4085613041166590560',
        zalo_url: 'https://zalo.me/4085613041166590560',
        messenger_url: 'https://m.me/MaianHomes',
        email: 'contact@maianhomes.vn',
        email_href: 'mailto:contact@maianhomes.vn',
      }),
    });
  });

  await page.goto('/lien-he', {waitUntil: 'domcontentloaded'});
  await expect(page.getByTestId('floating-contact-widget')).toHaveCount(1);
  await expect(page.getByTestId('zalo-oa-chat-widget')).toHaveAttribute('data-state', 'closed');
  await page.getByRole('button', {name: 'Mở menu hỗ trợ'}).click();

  await expect(page.getByRole('link', {name: 'Nhắn Zalo với nhân viên'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Gọi điện tư vấn'})).toHaveAttribute('href', 'tel:0969105059');
  await expect(page.getByTestId('floating-contact-widget').getByRole('link', {name: 'Gửi email'})).toHaveAttribute('href', 'mailto:contact@maianhomes.vn');
  await expect(page.getByRole('link', {name: 'Liên hệ qua Messenger'})).toHaveAttribute('href', 'https://m.me/MaianHomes');
  await expect(page.getByRole('link', {name: 'Liên hệ qua Zalo cá nhân'})).toHaveAttribute('href', 'https://zalo.me/4085613041166590560');

  const zaloButton = page.getByRole('link', {name: 'Nhắn Zalo với nhân viên'});
  await expect(zaloButton).toBeVisible();
  await zaloButton.click();

  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>('.zalo-chat-widget iframe');
    frame?.setAttribute('height', '420');
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://page.widget.zalo.me',
      data: {cmd: 'zchat_widget_open_chat_box', width: 350, height: 420},
    }));
  });
  await expect(page.getByTestId('zalo-oa-chat-widget')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('floating-contact-widget')).toHaveCount(1);

  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://page.widget.zalo.me',
      data: {cmd: 'zchat_widget_close_chat_box', width: 70, height: 70},
    }));
  });
  await expect(page.getByRole('button', {name: 'Đóng menu hỗ trợ'})).toBeVisible();

  await page.getByRole('button', {name: 'Hỏi trợ lý Mái Đỏ'}).click();
  await expect(page.getByText('Mái Đỏ · Maian Homes')).toBeVisible();
  await expect(page.getByTestId('floating-contact-widget')).toHaveCount(0);

  await page.getByRole('button', {name: 'Đóng chat'}).click();
  await expect(page.getByRole('button', {name: 'Mở menu hỗ trợ'})).toBeVisible();
});
test('floating contact widget recovers when contact settings API becomes available', async ({page}) => {
  let attempts = 0;
  await page.addInitScript(() => window.localStorage.clear());
  await page.route('**/api/public/contact-settings', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({detail: 'Backend is starting'}),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        phone: '0969105059',
        phone_href: 'tel:0969105059',
        messenger_url: 'https://m.me/MaianHomes',
        email: 'contact@maianhomes.vn',
        email_href: 'mailto:contact@maianhomes.vn',
      }),
    });
  });

  await page.goto('/lien-he', {waitUntil: 'domcontentloaded'});
  const contactWidget = page.getByTestId('floating-contact-widget');
  await expect(contactWidget).toBeVisible();
  await contactWidget.getByRole('button', {name: 'Mở menu hỗ trợ'}).click();
  await expect(contactWidget.getByRole('button', {name: 'Hỏi trợ lý Mái Đỏ'})).toBeVisible();
  await expect(contactWidget.getByRole('link', {name: 'Gọi điện tư vấn'})).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});

test('floating contact control stays inside the viewport without horizontal overflow', async ({page}) => {
  await page.route('**/api/public/contact-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        phone: null,
        phone_href: null,
        messenger_url: null,
        email: null,
        email_href: null,
      }),
    });
  });

  await page.goto('/ky-gui', {waitUntil: 'domcontentloaded'});
  const toggle = page.getByRole('button', {name: 'Mở menu hỗ trợ'});
  await expect(toggle).toBeVisible();

  const viewport = page.viewportSize();
  const toggleBox = await toggle.boundingBox();
  expect(viewport).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  expect(toggleBox!.x).toBeGreaterThanOrEqual(0);
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(toggleBox!.y + toggleBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport!.width);

});
