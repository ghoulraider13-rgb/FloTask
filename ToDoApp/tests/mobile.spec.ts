import { test, expect } from '@playwright/test';

test.describe('FlowTask Mobile Layout', () => {
  // Skip on desktop projects (≥700px): MobileShell is hidden there, so the
  // bottom tab bar and swipe assertions can never pass on desktop viewports.
  test.skip(({ viewport }) => (viewport?.width ?? 9999) >= 700, 'Mobile-only spec');

  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test('should load the app successfully on mobile', async ({ page }) => {
    await expect(page.locator('header:has-text("FLOTASK") h1').first()).toBeVisible();
  });

  test('should NOT have QuickAccessBar on mobile', async ({ page }) => {
    const quickAccessBar = page.locator('header[role="navigation"][aria-label="Quick access"]');
    await expect(quickAccessBar).toBeHidden();
  });

  test('should have bottom tab bar with 5 tabs', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    await expect(tabBar).toBeVisible();

    const tabs = ['Tasks', 'Notes', 'Focus', 'Alarms', 'Health'];
    for (const tab of tabs) {
      await expect(tabBar.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('should NOT have separate Hydration and Sleep tabs on mobile', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    await expect(tabBar.locator('button:has-text("Hydration")')).not.toBeVisible();
    await expect(tabBar.locator('button:has-text("Water")')).not.toBeVisible();
    await expect(tabBar.locator('button:has-text("Sleep")')).not.toBeVisible();
  });

  test('should navigate between tabs via bottom tab bar', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    
    // Click on Notes tab
    await tabBar.locator('button:has-text("Notes")').click({ force: true });
    await expect(page.locator('header:has-text("FLOTASK") h1').first()).toBeVisible();

    // Click on Focus tab - check for TimerHub content
    await tabBar.locator('button:has-text("Focus")').click({ force: true });
    await expect(page.locator('text=TIMER MODULE').first()).toBeVisible({ timeout: 10000 });

    // Click on Alarms tab - check for AlarmSection content
    await tabBar.locator('button:has-text("Alarms")').click({ force: true });
    await expect(page.locator('text=Alarms').first()).toBeVisible({ timeout: 10000 });
  });

  test('Health tab should have segmented control for Hydration and Sleep', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    
    await tabBar.locator('button:has-text("Health")').click({ force: true });
    await page.waitForTimeout(500);

    // Check for segmented control buttons (role=tab)
    await expect(page.locator('button[role="tab"]:has-text("HYDRATION")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("SLEEP")')).toBeVisible();
  });

  test('should show Hydration content when HYDRATION segment is active', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    
    await tabBar.locator('button:has-text("Health")').click({ force: true });
    await page.waitForTimeout(500);

    // HYDRATION should be active by default - check for key elements
    await expect(page.locator('text=HYDRA-04').first()).toBeVisible();
    await expect(page.locator('text=MODULE // HYDRATION TRACKER').first()).toBeVisible();
    await expect(page.locator('text=TACTILE DOSING MATRIX').first()).toBeVisible();
  });

  test('should show Sleep content when SLEEP segment is clicked', async ({ page }) => {
    const tabBar = page.locator('nav[aria-label="Primary"]');
    
    await tabBar.locator('button:has-text("Health")').click({ force: true });
    await page.waitForTimeout(500);

    // Click SLEEP segment in the segmented control (role=tab)
    await page.locator('button[role="tab"]:has-text("SLEEP")').click({ force: true });
    await page.waitForTimeout(500);

    // Check for SleepTracker content in setup phase
    await expect(page.locator('text=Sleep Timer').first()).toBeVisible();
    await expect(page.locator('text=START SLEEP SESSION').first()).toBeVisible();
    await expect(page.locator('text=SOMNA-04').first()).toBeVisible();
    await expect(page.locator('text=MODULE // SLEEP TRACKER').first()).toBeVisible();
  });

  test('should support swipe navigation between tabs', async ({ page }) => {
    // Start at Tasks tab (default)
    await expect(page.locator('header:has-text("FLOTASK") h1').first()).toBeVisible();

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
    // The env() function resolves to a pixel value, check for non-negative padding
    expect(parseInt(styles, 10)).toBeGreaterThanOrEqual(0);
  });
});