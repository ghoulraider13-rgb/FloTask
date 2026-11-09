import { test, expect } from '@playwright/test';

/**
 * Mobile layout — the SAME single-column page as desktop (no carousel,
 * no bottom tab bar). Navigation is the sticky QuickAccessBar pill strip.
 */
test.describe('FloTask Mobile Layout', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  const SECTIONS = ['tasks', 'notes', 'focus', 'alarms', 'hydration', 'sleep'];
  const nav = (page) => page.locator('header[role="navigation"][aria-label="Quick access"]');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('loads with the FLOTASK hero', async ({ page }) => {
    await expect(page.locator('h1:has-text("FLOTASK")')).toBeVisible();
  });

  test('has no mobile-only fork (carousel / bottom tab bar)', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(0);
    await expect(page.locator('button[role="tab"]:has-text("HYDRATION")')).toHaveCount(0);
  });

  test('renders every section in one document flow', async ({ page }) => {
    for (const id of SECTIONS) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
  });

  test('sections stack in a single column', async ({ page }) => {
    const boxes = await Promise.all(
      SECTIONS.map((id) => page.locator(`section#${id}`).boundingBox())
    );
    const xs = new Set(boxes.map((b) => Math.round(b.x)));
    expect(xs.size).toBe(1);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
    }
  });

  test('page never scrolls horizontally', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('sticky nav stays visible after scrolling', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const box = await nav(page).boundingBox();
    expect(box.y).toBeLessThanOrEqual(1);
    await expect(nav(page)).toBeInViewport();
  });

  test('nav pills meet the 44px touch target', async ({ page }) => {
    const pills = nav(page).locator('button[data-nav-pill]');
    await expect(pills).toHaveCount(SECTIONS.length);
    for (const pill of await pills.all()) {
      const box = await pill.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('tapping a pill scrolls to the section and marks it active', async ({ page }) => {
    const navHeight = (await nav(page).boundingBox()).height;
    for (const id of ['alarms', 'sleep', 'tasks']) {
      await nav(page).locator(`button[data-nav-pill="${id}"]`).click();
      const sectionTop = () =>
        page.locator(`section#${id}`).evaluate((el) => el.getBoundingClientRect().top);
      // Section heading settles just below the sticky nav (not hidden under
      // it, not far below). Poll: long smooth scrolls take > 1s.
      await expect
        .poll(async () => {
          const top = await sectionTop();
          return top >= navHeight - 2 && top < navHeight + 120;
        }, { timeout: 5000 })
        .toBe(true);
      await expect(nav(page).locator(`button[data-nav-pill="${id}"]`)).toHaveAttribute('aria-current', 'true');
    }
  });

  test('scroll-spy updates the active pill on manual scroll', async ({ page }) => {
    await page.locator('section#hydration').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    await expect(nav(page).locator('button[data-nav-pill="hydration"]')).toHaveAttribute('aria-current', 'true');
  });

  test('scroll-spy still works under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('section#alarms').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    await expect(nav(page).locator('button[data-nav-pill="alarms"]')).toHaveAttribute('aria-current', 'true');
  });

  test('trackers render inline (no Health segmented screen)', async ({ page }) => {
    await expect(page.locator('section#hydration').locator('text=HYDRA-04').first()).toBeAttached();
    await expect(page.locator('section#sleep').locator('text=SOMNA-04').first()).toBeAttached();
  });
});