import { test, expect } from '@playwright/test';

test.describe('Phase P3 Features — FloTask', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Command Palette opens with shortcut and button, filters actions, and closes with ESC', async ({ page }) => {
    // Open via visible button
    const cmdButton = page.locator('button[aria-label="Open command palette"]:visible');
    await expect(cmdButton).toBeVisible();
    await cmdButton.click();

    const dialog = page.locator('[role="dialog"][aria-labelledby="command-palette-title"]');
    await expect(dialog).toBeVisible();

    // Search query
    const input = page.locator('#command-palette-title');
    await input.fill('backup');
    await expect(page.getByText('EXPORT JSON BACKUP')).toBeVisible();
    await expect(page.getByText('RESTORE JSON BACKUP')).toBeVisible();

    // Close via ESC
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // Open via Ctrl+K / Meta+K
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Keyboard Shortcuts modal opens with ? and button, and closes with ESC', async ({ page }) => {
    const shortcutsBtn = page.locator('button[aria-label="Show keyboard shortcuts"]:visible');
    await expect(shortcutsBtn).toBeVisible();
    await shortcutsBtn.click();

    const modal = page.locator('[role="dialog"][aria-labelledby="shortcuts-title"]');
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading', { name: 'KEYBOARD SHORTCUTS' })).toBeVisible();
    await expect(page.getByText('Focus new task input')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Open with ? key
    await page.keyboard.press('?');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Recurring tasks support RRULE presets and display recurrence badge', async ({ page }) => {
    // Open options in AddTaskForm
    const optionsToggle = page.locator('button[title*="Manual reminder options"]').first();
    await optionsToggle.click();

    // Recurrence select should be visible
    const recurrenceSelect = page.locator('select[aria-label="Recurrence frequency"]');
    await expect(recurrenceSelect).toBeVisible();
    await recurrenceSelect.selectOption('FREQ=DAILY');

    // Add recurring task
    const taskInput = page.locator('#add-task-input');
    await taskInput.fill('Daily Standup Meeting');
    await page.locator('#add-task-button').click();

    // Verify task row and recurrence badge
    const taskItem = page.locator('[data-swipe-to-delete]').first();
    await expect(taskItem).toContainText('Daily Standup Meeting');
    await expect(taskItem).toContainText('↻');
    await expect(taskItem).toContainText('DAILY');

    // Completing recurring task generates next occurrence
    const checkbox = taskItem.locator('input[type="checkbox"]');
    await checkbox.click();

    // Wait for 350ms completion transition
    await page.waitForTimeout(400);

    // Both completed task and new recurring active instance should exist
    await expect(page.getByText('Daily Standup Meeting')).toHaveCount(2);
  });

  test('Subtasks render indented with connector line and block parent completion', async ({ page }) => {
    // Create root task
    const taskInput = page.locator('#add-task-input');
    await taskInput.fill('Deploy Release v2');
    await page.locator('#add-task-button').click();

    // Click + SUBTASK
    const addSubtaskBtn = page.locator('button[title="Add subtask"]').first();
    await expect(addSubtaskBtn).toBeVisible();
    await addSubtaskBtn.click();

    // Fill subtask input
    const subtaskInput = page.locator('input[placeholder="Subtask title…"]');
    await expect(subtaskInput).toBeVisible();
    await subtaskInput.fill('Run Playwright Suite');
    await page.locator('form:has(input[placeholder*="Subtask"]) button[type="submit"]').click();

    // Check that subtask exists with ↳ connector
    await expect(page.getByText('Run Playwright Suite')).toBeVisible();
    await expect(page.getByText('↳')).toBeVisible();

    // Attempt to complete root task — should be blocked
    const rootTaskCheckbox = page.locator('input[aria-label*="Deploy Release v2"]');
    await rootTaskCheckbox.click();

    // Blocked notice appears and parent remains uncompleted
    await expect(page.getByText(/Blocked by subtasks/i)).toBeVisible();
    await expect(rootTaskCheckbox).not.toBeChecked();

    // Complete the subtask first and wait for transition
    const subtaskCheckbox = page.locator('input[aria-label*="Run Playwright Suite"]');
    await subtaskCheckbox.click();
    await page.waitForTimeout(400);

    // Now complete the parent task — succeeds
    await rootTaskCheckbox.click();
    await page.waitForTimeout(400);
    await expect(rootTaskCheckbox).toBeChecked();
  });

  test('Focus Sessions History chart renders in Timer Module', async ({ page }) => {
    const focusSection = page.locator('#focus');
    await expect(focusSection).toBeVisible();

    // Check Focus History title and ruled grid
    await expect(page.getByText('FOCUS HISTORY // 7 DAYS')).toBeVisible();
    await expect(page.getByText('MIN TOTAL')).toBeVisible();

    const svg = focusSection.locator('svg').nth(1); // second svg is the chart
    await expect(svg).toBeVisible();
  });
});
