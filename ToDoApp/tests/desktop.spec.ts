import { test, expect } from '@playwright/test';

test.describe('FlowTask Desktop Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the app successfully', async ({ page }) => {
    await expect(page.locator('h1:has-text("FLOTASK")')).toBeVisible();
  });

  test('should have QuickAccessBar on desktop', async ({ page }) => {
    // Check for the sticky top bar
    const quickAccessBar = page.locator('header[role="navigation"][aria-label="Quick access"]');
    await expect(quickAccessBar).toBeVisible();

    // Check for all section buttons
    const sections = ['TASKS', 'NOTES', 'FOCUS', 'ALARMS', 'HYDRATION', 'SLEEP'];
    for (const section of sections) {
      await expect(page.locator(`button:has-text("${section}")`)).toBeVisible();
    }
  });

  test('should have FLOTASK wordmark in QuickAccessBar', async ({ page }) => {
    await expect(page.locator('header[role="navigation"] >> text=FLOTASK')).toBeVisible();
  });

  test('should have all desktop sections with proper IDs', async ({ page }) => {
    const sections = ['tasks', 'notes', 'focus', 'alarms', 'hydration', 'sleep'];
    for (const section of sections) {
      await expect(page.locator(`section#${section}`)).toBeVisible();
    }
  });

  test('should have proper section headings', async ({ page }) => {
    const headings = [
      { id: 'tasks-heading', text: 'TASKS' },
      { id: 'notes-heading', text: 'NOTES' },
      { id: 'focus-heading', text: 'FOCUS' },
      { id: 'alarms-heading', text: 'ALARMS' },
      { id: 'hydration-heading', text: 'HYDRATION TRACKER' },
      { id: 'sleep-heading', text: 'SLEEP TRACKER' },
    ];

    for (const heading of headings) {
      await expect(page.locator(`#${heading.id}`)).toContainText(heading.text);
    }
  });

  test('QuickAccessBar smooth scroll navigation', async ({ page }) => {
    // Click on Sleep section in quick access bar
    await page.locator('button:has-text("SLEEP")').click();
    await page.waitForTimeout(500);

    // Check that sleep section is in view
    const sleepSection = page.locator('section#sleep');
    await expect(sleepSection).toBeInViewport();
  });

  test('should have HydrationTracker with Stitch-inspired design', async ({ page }) => {
    const hydrationSection = page.locator('section#hydration');
    await expect(hydrationSection).toBeVisible();

    // Check for key HydrationTracker elements
    await expect(page.locator('text=HYDRA-04')).toBeVisible();
    await expect(page.locator('text=MODULE // HYDRATION TRACKER')).toBeVisible();
    await expect(page.locator('text=INTAKE TOTAL')).toBeVisible();
    await expect(page.locator('text=TACTILE DOSING MATRIX')).toBeVisible();
    await expect(page.locator('text=HYDRA-HALT PROTOCOL')).toBeVisible();
    await expect(page.locator('text=CIRCADIAN TAPER')).toBeVisible();
    await expect(page.locator('text=CHAMBER')).toBeVisible();
  });

  test('should have SleepTracker with Stitch-inspired design', async ({ page }) => {
    const sleepSection = page.locator('section#sleep');
    await expect(sleepSection).toBeVisible();

    // Check for key SleepTracker elements
    await expect(page.locator('text=SYS.BIO // HYPNOGRAM_V04')).toBeVisible();
    await expect(page.locator('text=OPTICAL.HRV')).toBeVisible();
    await expect(page.locator('text=SESSION READOUT')).toBeVisible();
    await expect(page.locator('text=HYPNOGRAM ARCHITECTURE')).toBeVisible();
    await expect(page.locator('text=RHR DIP // HAMMOCK DYNAMICS')).toBeVisible();
    await expect(page.locator('text=LATENCY')).toBeVisible();
    await expect(page.locator('text=RESTFULNESS')).toBeVisible();
    await expect(page.locator('text=RESPIRATION')).toBeVisible();
    await expect(page.locator('text=CIRCADIAN')).toBeVisible();
  });
});