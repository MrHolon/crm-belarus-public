import { expect, test } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import { TEST_USERS, type TestRole } from './fixtures/test-users';

const ROLES: TestRole[] = [
  'specialist',
  'duty_officer',
  'developer',
  'accountant',
  'manager',
  'admin',
];

for (const role of ROLES) {
  const user = TEST_USERS[role];

  test.describe(`role: ${role}`, () => {
    test('can log in and sees the role-appropriate navbar', async ({ page }) => {
      await loginAs(page, role);

      // User menu shows the localized role label.
      await expect(page.getByText(user.roleLabel).first()).toBeVisible();

      for (const label of user.expectedNavItems) {
        await expect(
          page.getByRole('link', { name: label }).first(),
          `role ${role} must see nav item "${label}"`,
        ).toBeVisible();
      }

      for (const label of user.forbiddenNavItems) {
        await expect(
          page.getByRole('link', { name: label }),
          `role ${role} must NOT see nav item "${label}"`,
        ).toHaveCount(0);
      }
    });

    test('refresh keeps session (no blank page after reload)', async ({ page }) => {
      await loginAs(page, role);
      await page.reload();
      await expect(
        page.getByRole('link', { name: 'Настройки' }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('CRM Belarus').first()).toBeVisible();
    });
  });
}
