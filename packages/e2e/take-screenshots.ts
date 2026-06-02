/**
 * Screenshot script — run with:
 *   pnpm e2e:up && npx ts-node take-screenshots.ts
 *
 * Generates fresh docs/screenshots/*.png from the live E2E environment.
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:8081';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@test.local';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'test1234';
const OUT = path.join(__dirname, '../../docs/screenshots');

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('[data-testid="password-form"]');
  await page.fill('[data-testid="email-input"]', ADMIN_EMAIL);
  await page.fill('[data-testid="password-input"]', ADMIN_PASSWORD);
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10_000 });
}

async function shot(page: import('@playwright/test').Page, name: string) {
  // Brief settle time for charts / animations
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function setTheme(page: import('@playwright/test').Page, dark: boolean) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    localStorage.setItem('theme', d ? 'dark' : 'light');
  }, dark);
  await page.waitForTimeout(200);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 820 } });
  const page = await ctx.newPage();

  console.log('\nLogging in...');
  await login(page);

  // ── Light mode screenshots ─────────────────────────────────────────────────
  await setTheme(page, false);

  console.log('\nLight mode:');
  await page.goto(`${BASE}/`);
  await shot(page, 'dashboard-light');

  await page.goto(`${BASE}/sessions`);
  await shot(page, 'sessions-light');

  await page.goto(`${BASE}/projects`);
  await shot(page, 'projects-light');

  await page.goto(`${BASE}/leaderboard`);
  await shot(page, 'leaderboard-light');

  await page.goto(`${BASE}/cost-comparison`);
  await shot(page, 'cost-comparison-light');

  await page.goto(`${BASE}/admin/org`);
  await shot(page, 'org-light');

  await page.goto(`${BASE}/admin/team`);
  await shot(page, 'team-light');

  await page.goto(`${BASE}/profile`);
  await shot(page, 'profile-light');

  await page.goto(`${BASE}/admin/settings`);
  await shot(page, 'settings-light');

  await page.goto(`${BASE}/help`);
  await shot(page, 'help-light');

  // ── Manage UI (Platform Owner sees all sections) ─────────────────────────
  await page.goto(`${BASE}/manage/organizations`);
  await shot(page, 'manage-organizations-light');

  await page.goto(`${BASE}/manage/workspaces`);
  await shot(page, 'manage-workspaces-light');

  await page.goto(`${BASE}/manage/members`);
  await shot(page, 'manage-members-light');

  await page.goto(`${BASE}/manage/domain-rules`);
  await shot(page, 'manage-domain-rules-light');

  await page.goto(`${BASE}/manage/audit`);
  await shot(page, 'manage-audit-light');

  // ── Dark mode screenshots ──────────────────────────────────────────────────
  await setTheme(page, true);

  console.log('\nDark mode:');
  await page.goto(`${BASE}/`);
  await shot(page, 'dashboard-dark');

  await page.goto(`${BASE}/leaderboard`);
  await shot(page, 'leaderboard-dark');

  await page.goto(`${BASE}/cost-comparison`);
  await shot(page, 'cost-comparison-dark');

  await browser.close();
  console.log('\nDone. Screenshots saved to docs/screenshots/\n');
})();
