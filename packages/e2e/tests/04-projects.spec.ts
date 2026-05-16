import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
  });

  test('renders projects page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('renders project cards with seeded data', async ({ page }) => {
    // ProjectsPage converts aliases via getDisplayName() — deterministic name generator
    // proj-0 → light-river-steer, proj-1 → subtle-star-climb, proj-2 → ivory-trail-march
    await expect(page.getByText('light-river-steer')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('subtle-star-climb')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('ivory-trail-march')).toBeVisible({ timeout: 8_000 });
  });

  test('shows token usage data for projects', async ({ page }) => {
    await expect(page.getByText('light-river-steer')).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to projects from sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /projects/i }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });
});
