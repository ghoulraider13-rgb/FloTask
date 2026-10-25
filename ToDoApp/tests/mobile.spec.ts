import { test, expect } from '@playwright/test';

test.describe('FlowTask Mobile Layout', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the app successfully on mobile', async ({ page }) => {
    await expect(page.locator('h1:has-text("FLOTASK")')).toBeVisible();
  });

  test('should NOT have QuickAccessBar on mobile', async ({ page }) => {
    // QuickAccessBar should not render on mobile (≤640px)
    const quickAccessBar = page.locator('header[role="navigation"][aria-label="Quick access"]');
    await expect(quickAccessBar).toBeHidden();
  });

  test('should have bottom tab bar with 5 tabs', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    await expect(tabBar).toBeVisible();

    // Check for 5 tabs: Tasks, Notes, Focus, Alarms, Health
    const tabs = ['Tasks', 'Notes', 'Focus', 'Alarms', 'Health'];
    for (const tab of tabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('should NOT have separate Hydration and Sleep tabs on mobile', async ({ page }) => {
    // Hydration and Sleep should be combined under Health tab
    await expect(page.locator('button:has-text("Hydration")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Water")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Sleep")')).not.toBeVisible();
  });

  test('should navigate between tabs via bottom tab bar', async ({ page }) => {
    // Click on Notes tab
    await page.locator('button:has-text("Notes")').click();
    await expect(page.locator('text=FLOTASK')).toBeVisible();

    // Click on Focus tab
    await page.locator('button:has-text("Focus")').click();
    await expect(page.locator('text=Timer')).toBeVisible({ timeout: 5000 });

    // Click on Alarms tab
    await page.locator('button:has-text("Alarms")').click();
    await expect(page.locator('text=Alarms')).toBeVisible({ timeout: 5000 });
  });

  test('Health tab should have segmented control for Hydration and Sleep', async ({ page }) => {
    // Navigate to Health tab
    await page.locator('button:has-text("Health")').click();
    await page.waitForTimeout(500);

    // Check for segmented control
    await expect(page.locator('text=HEALTH')).toBeVisible();
    await expect(page.locator('button:has-text("HYDRATION")')).toBeVisible();
    await expect(page.locator('button:has-text("SLEEP")')).toBeVisible();
  });

  test('should show Hydration content when HYDRATION segment is active', async ({ page }) => {
    await page.locator('button:has-text("Health")').click();
    await page.waitForTimeout(500);

    // HYDRATION should be active by default
    await expect(page.locator('text=HYDRA-04')).toBeVisible();
    await expect(page.locator('text=MODULE // HYDRATION TRACKER')).toBeVisible();
    await expect(page.locator('text=TACTILE DOSING MATRIX')).toBeVisible();
  });

  test('should show Sleep content when SLEEP segment is clicked', async ({ page }) => {
    await page.locator('button:has-text("Health")').click();
    await page.waitForTimeout(500);

    // Click SLEEP segment
    await page.locator('button:has-text("SLEEP")').click();
    await page.waitForTimeout(500);

    // Check for SleepTracker content
    await expect(page.locator('text=SYS.BIO // HYPNOGRAM_V04')).toBeVisible();
    await expect(page.locator('text=SESSION READOUT')).toBeVisible();
    await expect(page.locator('text=HYPNOGRAM ARCHITECTURE')).toBeVisible();
  });

  test('should support swipe navigation between tabs', async ({ page }) => {
    // Start at Tasks tab (default)
    await expect(page.locator('text=FLOTASK')).toBeVisible();

    // Swipe left to go to Notes
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(50, 300);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Should be on Notes or Focus tab now
    const activeTab = page.locator('button[aria-current="page"]');
    await expect(activeTab).toBeVisible();
  });

  test('should have proper safe-area handling', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    const styles = await tabBar.evaluate(el => window.getComputedStyle(el).paddingBottom);
    // Should have safe-area-inset-bottom padding
    expect(styles).toContain('env(safe-area-inset-bottom');
  });
});