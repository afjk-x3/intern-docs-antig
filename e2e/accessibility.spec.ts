import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Makes the WCAG 2.1 AA scan from docs/09-project-audit.md (2026-08-27, "Accessibility
// scan + keyboard pass") a standing CI gate instead of a manual one-off -- that entry's
// own "Next steps" flagged this as the natural follow-up once Playwright existed.
// Scoped to unauthenticated pages for the same reason as e2e/smoke.spec.ts; the
// authenticated pages the manual pass also covered are a further step.

const PUBLIC_PAGES = ['/login', '/accept-invite'];

for (const path of PUBLIC_PAGES) {
  test(`${path} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
