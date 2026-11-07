import { expect, test } from '@playwright/test';

const question = 'Where can I visit a pottery workshop?';
const answer = 'You can find workshops on the village map.';
const copy = {
  en: {
    open: 'Ask the Fox',
    close: 'Close the assistant',
    history: 'Conversation history',
    newChat: 'New conversation',
    remove: 'Delete conversation',
    back: 'Back to chat',
    empty: 'No saved conversations yet.',
    input: 'Your question for the Fox',
    send: 'Send',
  },
  vi: {
    open: 'Hỏi Cáo',
    close: 'Đóng trợ lý',
    history: 'Lịch sử trò chuyện',
    newChat: 'Cuộc trò chuyện mới',
    remove: 'Xóa cuộc trò chuyện',
    back: 'Quay lại trò chuyện',
    empty: 'Chưa có cuộc trò chuyện nào được lưu.',
    input: 'Câu hỏi cho Cáo',
    send: 'Gửi',
  },
};

for (const width of [1024, 360]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`assistant history at ${width}px in ${theme} theme`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(90_000);
      const locale = width === 360 ? 'vi' : 'en';
      const t = copy[locale];
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await context.route('**/api/v1/assistant/messages', async (route) => {
        await route.fulfill({
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ type: 'delta', text: answer })}\n\ndata: ${JSON.stringify(
            {
              type: 'done',
              messageId: '00000000-0000-7000-8000-000000000001',
            },
          )}\n\n`,
        });
      });
      await page.goto(`/${locale}`);
      const launcher = page.getByRole('button', { name: t.open, exact: true });
      await launcher.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(launcher).toBeHidden();
      // The mobile drawer is visible before its opening transition has finished.
      await expect
        .poll(async () => {
          const rect = await dialog.boundingBox();
          return rect ? rect.y + rect.height : Number.POSITIVE_INFINITY;
        })
        .toBeLessThanOrEqual(800);
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error('Assistant dialog has no visible bounds');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(width === 1024 ? 80 : 0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
      if (width === 1024) expect(800 - bounds.y - bounds.height).toBeLessThanOrEqual(20);
      await page.getByRole('textbox', { name: t.input }).fill(question);
      await page.getByRole('button', { name: t.send, exact: true }).click();
      await expect(page.getByText(answer, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: t.newChat }).click();
      await page.getByRole('button', { name: t.history, exact: true }).click();
      const row = page.getByRole('button', { name: question, exact: true });
      await expect(row).toBeVisible();
      await expect(page.getByRole('button', { name: t.back })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`history-${width}-${theme}.png`) });
      await page.getByRole('button', { name: t.close }).click();
      await expect(launcher).toBeVisible();
      await expect(launcher).toBeFocused();
      await launcher.click();
      await page.getByRole('button', { name: t.history, exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(launcher).toBeFocused();
      await page.reload();
      await launcher.click();
      await page.getByRole('button', { name: t.history, exact: true }).click();
      await expect(row).toBeVisible();

      const otherTab = await context.newPage();
      await otherTab.setViewportSize({ width, height: 800 });
      await otherTab.goto(`/${locale}`);
      await otherTab.getByRole('button', { name: t.open, exact: true }).click();
      await otherTab.getByRole('button', { name: t.history, exact: true }).click();
      await otherTab.getByRole('button', { name: question, exact: true }).click();
      await expect(otherTab.getByText(answer, { exact: true })).toBeVisible();
      await otherTab.close();

      await row.click();
      await expect(page.getByText(answer, { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: t.input })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`chat-${width}-${theme}.png`) });
      await page.getByRole('button', { name: t.history, exact: true }).click();
      await page.getByRole('button', { name: t.remove }).click();
      await expect(page.getByText(t.empty, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t.back })).toBeFocused();
      if (width === 1024) {
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('button', { name: t.close })).toBeFocused();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('button', { name: t.close })).toBeFocused();
      }
      expect(errors).toEqual([]);
    });
  }
}

test('assistant history stays empty when localStorage is unavailable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage is blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/en');
  await page.getByRole('button', { name: copy.en.open, exact: true }).click();
  await page.getByRole('button', { name: copy.en.history, exact: true }).click();
  await expect(page.getByText(copy.en.empty, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: copy.en.newChat }).click();
  await page.getByRole('button', { name: copy.en.history, exact: true }).click();
  await expect(page.getByText(copy.en.empty, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('desktop focus and Escape work after reopening a rate-limited chat', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.route('**/api/v1/assistant/messages', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ type: 'blocked', reason: 'RATE_LIMITED', retryAfter: 60 })}\n\n`,
    }),
  );
  await page.goto('/en');
  const launcher = page.getByRole('button', { name: copy.en.open, exact: true });
  await launcher.click();
  const input = page.getByRole('textbox', { name: copy.en.input });
  await input.fill(question);
  await page.getByRole('button', { name: copy.en.send, exact: true }).click();
  await expect(input).toBeDisabled();
  await page.getByRole('button', { name: copy.en.close }).click();
  await launcher.click();
  await expect(page.getByRole('button', { name: copy.en.history, exact: true })).toBeFocused();
  await page.getByRole('button', { name: copy.en.history, exact: true }).click();
  await page.getByRole('button', { name: copy.en.back }).click();
  await expect(page.getByRole('button', { name: copy.en.history, exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: copy.en.close })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: copy.en.history, exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeVisible();
  await expect(launcher).toBeFocused();
});
