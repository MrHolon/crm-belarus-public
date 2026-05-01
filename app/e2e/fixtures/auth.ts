import { expect, type Page } from '@playwright/test';
import { TEST_PASSWORD, TEST_USERS, type TestRole } from './test-users';

/**
 * Log in via the real Mantine form on `/login`. Returns once the dashboard
 * navbar is visible so the next assertion starts on a stable page.
 */
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const user = TEST_USERS[role];
  await page.goto('/login');

  // Mantine renders both "Вход" and "Регистрация" tabpanels in the DOM;
  // scope to the signin <form> via its unique submit button text.
  const signInForm = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Войти' }),
  });

  await signInForm.getByLabel('Email').fill(user.email);
  await signInForm.getByLabel('Пароль', { exact: true }).fill(TEST_PASSWORD);

  await signInForm.getByRole('button', { name: 'Войти' }).click();

  await expect(page).toHaveURL(/\/$|\/(tasks|all-tasks|dashboard)/, {
    timeout: 15_000,
  });
  // Navbar "Настройки" is the most universally present link — wait for it
  // as a readiness signal instead of racing the dashboard content.
  await expect(
    page.getByRole('link', { name: 'Настройки' }).first(),
  ).toBeVisible({ timeout: 15_000 });
}
