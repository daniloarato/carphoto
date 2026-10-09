import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const photo = PNG.sync.write({ width: 120, height: 80, data: Buffer.alloc(120 * 80 * 4, 255) });
const input = { name: 'meu-carro.png', mimeType: 'image/png', buffer: photo };

test('upload, style selection, generation, comparison and download', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, generationConfigured: true } }));
  await page.route('**/api/edit', async (route) => {
    expect(route.request().postDataBuffer().toString()).toContain('rollingview');
    await route.fulfill({ contentType: 'image/png', body: photo });
  });
  await page.goto('/');
  await expect(page.locator('#generate-button')).toBeDisabled();
  await page.locator('#file-input').setInputFiles(input);
  await expect(page.locator('#source-image')).toBeVisible();
  await page.locator('label.preset').filter({ has: page.locator('[value="rollingview"]') }).click();
  await page.locator('#generate-button').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result-caption')).toContainText('ROLLINGVIEW');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await downloadPromise).suggestedFilename()).toBe('carphoto-rollingview.png');
  await page.locator('#file-input').setInputFiles({ ...input, name: 'outra-foto.png' });
  await expect(page.locator('#result')).toBeHidden();
});

test('shows provider error and allows retry with the selected photo', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, generationConfigured: true } }));
  await page.route('**/api/edit', (route) => route.fulfill({ status: 429, json: { error: 'O serviço atingiu seu limite de uso.' } }));
  await page.goto('/');
  await page.locator('#camera-input').setInputFiles(input);
  await page.locator('#generate-button').click();
  await expect(page.locator('#feedback')).toContainText('limite de uso');
  await expect(page.locator('#generate-button')).toBeEnabled();
  await expect(page.locator('#source-image')).toBeVisible();
  await expect(page.locator('#camera-input')).toHaveAttribute('capture', 'environment');
});

test('invalid file is rejected and missing API is clearly represented', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { ok: true, generationConfigured: false } }));
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(page.locator('#feedback')).toContainText('Não conseguimos abrir');
  await page.locator('#file-input').setInputFiles(input);
  await expect(page.locator('#availability')).toContainText('geração ainda está sendo preparada');
  await expect(page.locator('#generate-button')).toBeDisabled();
});

test('responsive layout has no horizontal overflow and hero asset loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await page.request.get('/assets/hero.png')).status()).toBe(200);
  await page.screenshot({ path: `test-results/carphoto-${test.info().project.name}.png`, fullPage: true });
});
