import { test, expect } from '@playwright/test';

// First real Playwright coverage (audit gap #14). Scoped to what's honestly testable
// without seeded test-user infrastructure: unauthenticated pages and the auth redirect
// chain every request goes through first. Authenticated-role flows (intern/approver/
// admin/system_admin dashboards) are a further step -- see docs/09-project-audit.md.

test.describe('Unauthenticated routing', () => {
  test('login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sign In/i);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('visiting the root page while signed out redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('visiting a protected role route while signed out redirects to /login', async ({ page }) => {
    for (const path of ['/intern', '/approver', '/admin', '/system-admin']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('an incorrect login shows a generic error, never confirming whether the email exists', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'nonexistent@example.test');
    await page.fill('input[type="password"]', 'wrong-password-at-least-12-chars');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('accept-invite page renders without a valid token (shows the base onboarding form)', async ({ page }) => {
    await page.goto('/accept-invite');
    await expect(page.getByText(/welcome to interndocs/i)).toBeVisible();
    await expect(page.locator('#fullName')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    // No session yet -> role unknown -> intern-only fields (dates, privacy ack) must not show.
    await expect(page.locator('#internshipStart')).toHaveCount(0);
  });
});
