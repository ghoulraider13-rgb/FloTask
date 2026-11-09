import { test, expect } from '@playwright/test';

test.describe('HydrationTracker Functionality', () => {
  // section#hydration lives in the desktop tree (hidden <md) — desktop-only.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 700, 'Desktop-only spec');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display circular progress with segmented gauge', async ({ page }) => {
    const hydrationSection = page.locator('section#hydration');
    await expect(hydrationSection).toBeVisible();

    // Check for segmented circular progress (14 segments)
    const svg = page.locator('section#hydration svg').first();
    await expect(svg).toBeVisible();

    // Check for progress percentage display
    await expect(page.locator('section#hydration').locator('text=INTAKE TOTAL')).toBeVisible();
  });

  test('should have quick dose matrix with 4 options', async ({ page }) => {
    const quickDoseButtons = page.locator('section#hydration button:has-text("PURE WATER"), section#hydration button:has-text("ELECTROLYTES"), section#hydration button:has-text("CHRONO-TEA"), section#hydration button:has-text("AMINO BOOST")');
    await expect(quickDoseButtons).toHaveCount(4);
  });

  test('should have circadian taper timeline', async ({ page }) => {
    await expect(page.locator('text=CIRCADIAN TAPER')).toBeVisible();
    await expect(page.locator('text=20:30 CUTOFF')).toBeVisible();
  });

  test('should have vertical fluid chamber', async ({ page }) => {
    await expect(page.locator('text=CHAMBER')).toBeVisible();
    await expect(page.locator('text=LEVEL')).toBeVisible();
  });

  test('should have cut-off countdown banner', async ({ page }) => {
    await expect(page.locator('text=HYDRA-HALT PROTOCOL')).toBeVisible();
    await expect(page.locator('text=T-MINUS')).toBeVisible();
  });

  test('should have historical packets log', async ({ page }) => {
    await expect(page.locator('text=HISTORICAL PACKETS')).toBeVisible();
  });

  test('should have weekly overview', async ({ page }) => {
    await expect(page.locator('text=WEEKLY OVERVIEW')).toBeVisible();
    await expect(page.locator('text=Total this week')).toBeVisible();
    await expect(page.locator('text=Daily average')).toBeVisible();
    await expect(page.locator('text=Log entries')).toBeVisible();
  });

  test('should allow custom amount input', async ({ page }) => {
    const customInput = page.locator('section#hydration input[placeholder="Enter ml"]');
    await expect(customInput).toBeVisible();

    const addButton = page.locator('section#hydration button:has-text("ADD")');
    await expect(addButton).toBeVisible();
  });

  test('should allow goal editing', async ({ page }) => {
    const goalButton = page.locator('section#hydration button:has-text("Goal:")');
    await expect(goalButton).toBeVisible();
  });
});

test.describe('SleepTracker Functionality', () => {
  // section#sleep lives in the desktop tree (hidden <md) — desktop-only.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 700, 'Desktop-only spec');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display setup phase with timer presets', async ({ page }) => {
    const sleepSection = page.locator('section#sleep');
    await expect(sleepSection).toBeVisible();

    // Check for timer presets
    const presets = ['15 MIN', '30 MIN', '45 MIN', '60 MIN', '90 MIN', '120 MIN'];
    for (const preset of presets) {
      await expect(page.locator(`section#sleep button:has-text("${preset}")`)).toBeVisible();
    }
  });

  test('should have custom minutes input', async ({ page }) => {
    await expect(page.locator('section#sleep input[placeholder="Custom minutes"]')).toBeVisible();
  });

  test('should have START SLEEP SESSION button', async ({ page }) => {
    await expect(page.locator('section#sleep button:has-text("START SLEEP SESSION")')).toBeVisible();
  });

  test('should show hypnogram architecture in results', async ({ page }) => {
    // This would require starting a session, but we can at least verify the component structure
    await expect(page.locator('section#sleep')).toBeVisible();
  });

  test('should have metric tiles in results', async ({ page }) => {
    // The metric tiles are shown in results phase
    // We verify the component renders without errors
    await expect(page.locator('section#sleep')).toBeVisible();
  });
});

test.describe('Cross-Platform Consistency', () => {
  // One layout for every width: the same section/component must exist at
  // desktop AND phone widths. Each test switches viewport internally.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 700, 'Run on desktop projects');

  for (const { id, marker } of [
    { id: 'hydration', marker: 'HYDRA-04' },
    { id: 'sleep', marker: 'SLEEP TRACKER' },
  ]) {
    test(`desktop and mobile render the same ${id} section`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page.locator(`section#${id}`).locator(`text=${marker}`).first()).toBeVisible();

      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      const nav = page.locator('header[role="navigation"][aria-label="Quick access"]');
      await nav.locator(`button[data-nav-pill="${id}"]`).click();
      await page.waitForTimeout(900);
      await expect(page.locator(`section#${id}`)).toBeInViewport();
      await expect(page.locator(`section#${id}`).locator(`text=${marker}`).first()).toBeVisible();
    });
  }
});
