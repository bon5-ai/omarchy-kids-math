const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const Garden = require('../garden/src/lessons');
const url = pathToFileURL(path.resolve(__dirname, '../garden/index.html')).href;
// The page reloads itself on hashchange, so a hash-only goto must wait for that reload instead of racing it.
const open = async (page, activity = '', learner = 'test') => {
  const target = `${url}#learner=${learner}&activity=${activity}`;
  if (page.url().split('#')[0] !== url) return page.goto(target);
  if (page.url() === target) return page.reload();
  await Promise.all([page.waitForEvent('load'), page.goto(target)]);
};
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const token = (page, id) => page.locator(`[data-token="${id}"]`);

test('bundled file opens offline with five original illustrations and no runtime errors', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  await page.context().setOffline(true);
  await open(page);
  await expect(page.locator('.activity-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Small steps.');
  expect(await page.locator('main img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/garden-home.png', fullPage: true });
  await page.locator('[data-activity="count"]').click();
  await expect(page.locator('#number-scene')).toHaveClass(/three-ready/);
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/garden-count.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('counting is one-to-one; hints and retries never skip or double-save', async ({ page }) => {
  await open(page, 'count');
  await token(page, 0).click(); await token(page, 0).click();
  await expect(page.locator('#model-caption')).toContainText('1 apple counted');
  await token(page, 1).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#model-caption')).toContainText('2 apples counted');
  await action(page, 'reset').click();
  await expect(page.locator('#model-caption')).toContainText('Touch an apple');
  await page.locator('[data-answer="4"]').click();
  await expect(page.locator('#feedback-copy')).toContainText('Let’s look together');
  await expect(action(page, 'next')).toBeHidden();
  await page.locator('[data-answer="5"]').click();
  await expect(page.locator('#equation')).toContainText('5');
  await expect(page.locator('[data-answer="5"]')).toBeDisabled();
  await page.getByRole('button', { name: 'For grown-ups' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kids-math-garden:v1:test')).activities.count)).toEqual({ solved: 1, supported: 1 });
});
test('frog actions conserve quantities, including mixed direct and button input', async ({ page }) => {
  await open(page, 'join');
  await token(page, 4).click();
  await action(page, 'manipulate').click();
  await expect(page.locator('#model-caption')).toContainText('3 here + 2 joined · 0 still waiting');
  for (let i = 0; i < 5; i++) await action(page, 'manipulate').click();
  await expect(action(page, 'manipulate')).toBeDisabled();
  await page.screenshot({ path: 'test-results/garden-join.png', fullPage: true });
  await page.locator('[data-activity="take"]').click();
  await token(page, 3).click();
  await action(page, 'manipulate').click();
  await expect(page.locator('.token.removed')).toHaveCount(2);
  await expect(page.locator('#model-caption')).toContainText('2 hopped away · 3 frogs stay');
  for (let i = 0; i < 3; i++) await action(page, 'manipulate').click();
  await expect(action(page, 'manipulate')).toBeDisabled();
  await page.screenshot({ path: 'test-results/garden-take.png', fullPage: true });
});
test('ten-frame models the missing part; towers each count as ten', async ({ page }) => {
  await open(page, 'ten');
  await expect(page.locator('.token.empty')).toHaveCount(4);
  await token(page, 6).click();
  await expect(page.locator('.token.empty')).toHaveCount(3);
  await token(page, 6).click();
  await expect(page.locator('.token.empty')).toHaveCount(4);
  for (let i = 0; i < 4; i++) await action(page, 'manipulate').click();
  await expect(page.locator('#model-caption')).toContainText('6 growing + 4 planted · 0 empty spaces');
  await page.locator('[data-answer="4"]').click();
  await expect(page.locator('#equation')).toHaveText('6+4=10');
  await page.screenshot({ path: 'test-results/garden-ten.png', fullPage: true });
  await open(page, 'tens');
  await expect(page.locator('.tower-token')).toHaveCount(2);
  await token(page, 0).click();
  await expect(page.locator('#model-caption')).toContainText('10 blocks counted');
  await token(page, 1).click();
  await expect(page.locator('#model-caption')).toContainText('20 blocks counted');
  for (let i = 2; i < 5; i++) await token(page, i).click();
  await expect(page.locator('#model-caption')).toContainText('23 blocks counted');
  await page.screenshot({ path: 'test-results/garden-tens.png', fullPage: true });
});
test('reduced-motion explanations, five-item stopping point, learner isolation and reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'count', 'sam');
  await action(page, 'demo').click();
  await expect(page.locator('#model-caption')).toContainText('5 apples counted');
  await expect(action(page, 'demo')).toHaveText('Show me');
  for (let i = 0; i < 5; i++) {
    const count = await page.locator('[data-token]').count();
    await page.locator(`[data-answer="${count}"]`).click();
    await action(page, 'next').click();
  }
  await expect(page.locator('h1')).toContainText('I can do it!');
  await page.screenshot({ path: 'test-results/garden-complete.png', fullPage: true });
  await open(page, '', 'sam');
  await page.getByRole('button', { name: 'For grown-ups' }).click();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('5');
  await open(page, '', 'alex');
  await page.getByRole('button', { name: 'For grown-ups' }).click();
  await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('0');
});
test('no WebGL or browser storage still leaves usable keyboard picture counters', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await open(page, 'count');
  await expect(page.locator('#number-scene')).not.toHaveClass(/three-ready/);
  await token(page, 0).focus(); await page.keyboard.press('Space');
  await expect(page.locator('#model-caption')).toContainText('1 apple counted');
  await page.locator('[data-answer="5"]').click();
  await expect(action(page, 'next')).toBeVisible();
  await page.getByRole('button', { name: 'For grown-ups' }).click();
  await expect(page.locator('dialog')).toContainText('observations last for this visit only');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).not.toBeVisible();
});
test('small screens keep answers and picture controls reachable with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/garden-mobile-home.png', fullPage: true });
  await page.locator('[data-activity="ten"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await token(page, 9).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#model-caption')).toContainText('1 planted');
  await page.locator('[data-answer="4"]').focus(); await page.keyboard.press('Enter');
  await expect(action(page, 'next')).toBeFocused();
  await page.screenshot({ path: 'test-results/garden-mobile-lesson.png', fullPage: true });
});
