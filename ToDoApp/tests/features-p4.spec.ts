import { test, expect } from '@playwright/test';

test.describe('Phase P4 Features — Voice & Agent UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('Agent-created tasks display monochrome ink-tone confidence badge', async ({ page }) => {
    // Inject agent-created task with high confidence into localStorage
    await page.evaluate(() => {
      const task = {
        id: 'agent-task-1',
        title: 'Review Agent PR Deliverable',
        completed: false,
        createdAt: new Date().toISOString(),
        isAgentCreated: true,
        confidence: 'high',
        intensity: 'medium',
        recurrence: '',
        parentId: null,
      };
      localStorage.setItem('todo-tasks', JSON.stringify([task]));
    });

    await page.reload();

    // Verify task row and AI confidence badge
    const taskRow = page.locator('[data-swipe-to-delete]').first();
    await expect(taskRow).toContainText('Review Agent PR Deliverable');
    await expect(taskRow).toContainText('AI');

    // Verify dot indicator uses ink tokens (solid primary ink for high confidence)
    const confidenceBadge = taskRow.locator('span[title*="Agent confidence: HIGH"]');
    await expect(confidenceBadge).toBeVisible();
    const dot = confidenceBadge.locator('span.rounded-full');
    await expect(dot).toHaveClass(/bg-ink-primary/);
  });

  test('Agent-created alarms display monochrome ink-tone confidence badge', async ({ page }) => {
    await page.evaluate(() => {
      const alarm = {
        id: 'agent-alarm-1',
        label: 'Standup Sync',
        dateTime: new Date(Date.now() + 3600000).toISOString(),
        intensity: 'high',
        fired: false,
        isAgentCreated: true,
        confidence: 'medium',
      };
      localStorage.setItem('todo-alarms', JSON.stringify([alarm]));
    });

    await page.reload();

    const alarmPill = page.locator('#alarms').getByText('Standup Sync');
    await expect(alarmPill).toBeVisible();

    const confidenceBadge = page.locator('#alarms span[title*="Agent alarm (Confidence: MEDIUM)"]');
    await expect(confidenceBadge).toBeVisible();
    await expect(confidenceBadge).toContainText('AI');
  });

  test('Offline parsing uses cached response with medium confidence', async ({ page }) => {
    // Populate offline cache in localStorage
    await page.evaluate(() => {
      const CACHE_KEY = 'flotask-nlm-cache';
      localStorage.setItem(CACHE_KEY, JSON.stringify([
        {
          query: 'water plants at 7pm',
          actions: [{ type: 'task', title: 'Water Plants', dueDateTime: '2026-11-10T19:00:00' }],
          timestamp: Date.now(),
        },
      ]));
    });

    // Simulate browser offline mode
    await page.context().setOffline(true);

    // Type query matching cached entry
    const taskInput = page.locator('#add-task-input');
    await taskInput.fill('water plants at 7pm');
    await page.locator('#add-task-button').click();

    // Verify task is created from offline cache with medium confidence
    await expect(page.getByText('Water Plants')).toBeVisible();
    const confidenceBadge = page.locator('span[title*="Agent confidence: MEDIUM"]');
    await expect(confidenceBadge).toBeVisible();

    await page.context().setOffline(false);
  });

  test('NLM error surfaces error notification toast or fallback task', async ({ page }) => {
    // Fill task input and click ADD with an unrecognized phrase when remote API is unavailable
    const taskInput = page.locator('#add-task-input');
    await taskInput.fill('xyz unknown gibberish prompt 12345');
    await page.locator('#add-task-button').click();

    // Since NLM fallback creates a task with agent indicator when remote fails
    await expect(page.getByText('xyz unknown gibberish prompt 12345')).toBeVisible();
  });
});
