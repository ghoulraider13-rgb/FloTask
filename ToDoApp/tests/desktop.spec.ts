import { test, expect } from '@playwright/test';

test.describe('FlowTask Desktop Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 60000 });
  });

  test('should load the app successfully', async ({ page }) => {
    await expect(page.locator('h1:has-text("FLOTASK")')).toBeVisible();
  });

  test('should have QuickAccessBar on desktop', async ({ page }) => {
    // Check for the sticky top bar
    const quickAccessBar = page.locator('header[role="navigation"][aria-label="Quick access"]');
    await expect(quickAccessBar).toBeVisible();

    // Check for all section buttons in QuickAccessBar specifically
    const sections = ['TASKS', 'NOTES', 'FOCUS', 'ALARMS', 'HYDRATION', 'SLEEP'];
    for (const section of sections) {
      await expect(quickAccessBar.locator(`button:has-text("${section}")`)).toBeVisible();
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
    // Click on Sleep section in quick access bar (specifically in the header)
    const quickAccessBar = page.locator('header[role="navigation"][aria-label="Quick access"]');
    await quickAccessBar.locator('button:has-text("SLEEP")').click();
    await page.waitForTimeout(500);

    // Check that sleep section is in view
    const sleepSection = page.locator('section#sleep');
    await expect(sleepSection).toBeInViewport();
  });

  test('should have HydrationTracker with Stitch-inspired design', async ({ page }) => {
    const hydrationSection = page.locator('section#hydration');
    await expect(hydrationSection).toBeVisible();

    // Check for key HydrationTracker elements (scope to hydration section)
    await expect(hydrationSection.locator('text=HYDRA-04').first()).toBeVisible();
    await expect(hydrationSection.locator('text=MODULE // HYDRATION TRACKER')).toBeVisible();
    await expect(hydrationSection.locator('text=INTAKE TOTAL')).toBeVisible();
    await expect(hydrationSection.locator('text=TACTILE DOSING MATRIX')).toBeVisible();
    await expect(hydrationSection.locator('text=HYDRA-HALT PROTOCOL')).toBeVisible();
    await expect(hydrationSection.locator('text=CIRCADIAN TAPER')).toBeVisible();
    await expect(hydrationSection.locator('text=CHAMBER')).toBeVisible();
  });

  test('should have SleepTracker with Stitch-inspired design', async ({ page }) => {
    const sleepSection = page.locator('section#sleep');
    await expect(sleepSection).toBeVisible();

    // Check for key SleepTracker elements visible in SETUP phase (initial state)
    // In setup phase: "Sleep Timer" label, timer presets, START SLEEP SESSION button
    await expect(sleepSection.locator('text=Sleep Timer')).toBeVisible();
    await expect(sleepSection.locator('text=15 MIN')).toBeVisible();
    await expect(sleepSection.locator('text=START SLEEP SESSION')).toBeVisible();
    await expect(sleepSection.locator('text=OPTICAL.HRV')).toBeVisible();
    await expect(sleepSection.locator('text=SYS.BIO // HYPNOGRAM_V04')).toBeVisible();
    // Results-phase elements (HYPNOGRAM ARCHITECTURE, RHR DIP, LATENCY, etc.) 
    // only appear after a session completes - not checked in initial state test
  });
});