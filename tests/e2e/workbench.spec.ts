import { expect, test } from '@playwright/test';
import { installDesktopApiFixture } from './desktopApi.fixture';
import { createSeededWorkspace } from '../../src/test/factories';

test.describe('SmartKMark workbench', () => {
  test('loads the seeded workspace and persists theme and layout changes', async ({
    page,
  }) => {
    await installDesktopApiFixture(page, createSeededWorkspace());

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Developer Workbench' })
    ).toBeVisible();
    await expect(page.getByText('API Contracts', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      'workbench-light'
    );

    await page.keyboard.press('Control+3');
    await expect(
      page.getByRole('button', { name: 'Cycle layout' })
    ).toContainText('Editor only');
    await expect(page.getByText('Notes', { exact: true })).toBeHidden();

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      'workbench-light'
    );
    await expect(
      page.getByRole('button', { name: 'Cycle layout' })
    ).toContainText('Editor only');
  });

  test('covers notebook lifecycle and note metadata flows', async ({ page }) => {
    await installDesktopApiFixture(page, createSeededWorkspace());

    await page.goto('/');

    await page
      .getByRole('button', { name: 'Create notebook', exact: true })
      .click();
    await page.getByLabel('New notebook name').fill('Drafts');
    await page.getByLabel('New notebook name').press('Enter');
    await expect(
      page.getByRole('button', { name: 'Drafts', exact: true })
    ).toBeVisible();

    await page.getByTitle('Rename Drafts').click();
    await page.getByLabel('Rename Drafts').fill('Backend Notes');
    await page.getByLabel('Rename Drafts').press('Enter');
    await expect(
      page.getByRole('button', { name: 'Backend Notes', exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Create note', exact: true }).click();
    await page.getByPlaceholder('Note title...').fill('Playwright Workbench');
    await page.locator('.cm-content').click();
    await page.keyboard.type('# Hello from Playwright');
    await page.waitForTimeout(1200);

    await page.getByLabel('Note status').selectOption('completed');
    await page.getByLabel('New tag name').fill('e2e');
    await page.getByLabel('New tag color').selectOption('green');
    await page.getByTitle('Add tag').click();
    await expect(
      page.getByRole('button', { name: 'Remove e2e tag', exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Pin', exact: true }).click();
    await page.getByLabel('Move note to notebook').selectOption('Backend Notes');
    await expect(
      page.getByRole('button', { name: 'Backend Notes', exact: true })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Pinned', exact: true }).click();
    await expect(
      page.getByText('Playwright Workbench', { exact: true }).first()
    ).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(
      page.getByText('Playwright Workbench', { exact: true }).first()
    ).toBeHidden();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTitle('Delete Backend Notes').click();
    await expect(
      page.getByRole('button', { name: 'Backend Notes', exact: true })
    ).toBeHidden();
  });

  test('uses quick open to jump between seeded notes and handles empty note lists', async ({
    page,
  }) => {
    await installDesktopApiFixture(page, createSeededWorkspace());

    await page.goto('/');

    await page.keyboard.press('Control+K');
    await expect(page.getByRole('dialog', { name: 'Quick open' })).toBeVisible();
    await page.getByLabel('Quick open search').fill('release');
    await page.getByLabel('Quick open search').press('Enter');
    await expect(
      page.getByRole('dialog', { name: 'Quick open' })
    ).toBeHidden();
    await expect(page.getByPlaceholder('Note title...')).toHaveValue(
      'Release Checklist'
    );

    await page.getByRole('button', { name: 'Docs', exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('No notes found.')).toBeVisible();
  });
});
