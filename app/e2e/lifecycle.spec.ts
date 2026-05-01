import { expect, test } from '@playwright/test';
import { loginAs } from './fixtures/auth';

/**
 * One end-to-end lifecycle flow in the real UI:
 *   specialist creates a task on himself → takes it → on review → done.
 *
 * Companion DB-level lifecycle tests live in
 * `tests/roles/lifecycle.test.ts` and exhaustively cover all 6 roles.
 * This spec exists to protect the UI plumbing (forms, Mantine selects,
 * navbar, status buttons) that the DB tests cannot see.
 */
test.describe('lifecycle e2e: specialist (UI)', () => {
  test('create → in_progress → on_review → done', async ({ page }) => {
    await loginAs(page, 'specialist');

    const title = `e2e ${Date.now()}`;

    await page.getByRole('link', { name: 'Новая задача' }).first().click();
    await expect(page).toHaveURL(/\/tasks\/new/);

    await page.getByLabel('Название').fill(title);
    await page
      .getByLabel('Описание')
      .fill('playwright lifecycle smoke test');

    await selectMantineOption(page, 'Категория');
    await selectMantineOption(page, 'Тип задачи');
    // Priority autofills from category default.
    // Assignee defaults to self (specialist).

    await page.getByRole('button', { name: 'Создать задачу' }).click();

    await expect(page).toHaveURL(/\/tasks\/\d+/, { timeout: 15_000 });

    // Badge for "Новая" appears on fresh task.
    await expect(page.getByText('Новая').first()).toBeVisible();

    await page
      .getByRole('button', { name: /Взять в работу \/ В работе/ })
      .click();
    await expect(page.getByText('В работе').first()).toBeVisible();

    await page.getByRole('button', { name: /→ На проверке/ }).click();
    await expect(page.getByText('На проверке').first()).toBeVisible();

    await page.getByRole('button', { name: /→ Выполнена/ }).click();
    await expect(page.getByText('Выполнена').first()).toBeVisible();
  });
});

/** Open a Mantine `<Select>` by its label, then pick the first option. */
async function selectMantineOption(
  page: import('@playwright/test').Page,
  label: string,
) {
  const select = page.getByLabel(label, { exact: true });
  await select.click();
  // Mantine renders options under role="option" inside a portal.
  await page.getByRole('option').first().click();
}
