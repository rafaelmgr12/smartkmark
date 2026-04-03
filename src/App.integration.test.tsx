import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { pressWindowShortcut, renderWithDesktopApi } from './test/helpers';
import { createSeededWorkspace } from './test/factories';

vi.mock('./components/editor/NoteEditor', () => ({
  default: ({ note }: { note: { title: string } | null }) => (
    <div data-testid="editor-note">{note?.title ?? 'No note selected'}</div>
  ),
}));

describe('App', () => {
  it('creates a note from the keyboard shortcut in the active notebook', async () => {
    const workspace = createSeededWorkspace();
    const { user, desktop } = renderWithDesktopApi(<App />, {
      seed: workspace,
    });

    await screen.findByRole('heading', { name: 'Developer Workbench' });

    await user.click(
      screen.getByRole('button', { name: 'Backend' })
    );

    pressWindowShortcut('n');

    await waitFor(() =>
      expect(desktop.mocks.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ notebookId: 'Backend', title: 'New Note' })
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId('editor-note')).toHaveTextContent('New Note')
    );
  });

  it('opens quick open and selects a note from the result list', async () => {
    const workspace = createSeededWorkspace();
    const { user } = renderWithDesktopApi(<App />, {
      seed: workspace,
    });

    await screen.findByRole('heading', { name: 'Developer Workbench' });

    pressWindowShortcut('k');

    const search = await screen.findByLabelText('Quick open search');
    await user.type(search, 'release');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Quick open' })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByTestId('editor-note')).toHaveTextContent('Release Checklist')
    );
  });

  it('switches layouts through keyboard shortcuts', async () => {
    const workspace = createSeededWorkspace();
    const { desktop } = renderWithDesktopApi(<App />, {
      seed: workspace,
    });

    await screen.findByRole('heading', { name: 'Developer Workbench' });

    pressWindowShortcut('2');

    await waitFor(() =>
      expect(desktop.mocks.updateSettings).toHaveBeenCalledWith({
        layoutMode: 'writer',
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Backend' })
      ).not.toBeInTheDocument()
    );

    pressWindowShortcut('3');

    await waitFor(() =>
      expect(screen.queryByText('Notes', { exact: true })).not.toBeInTheDocument()
    );

    pressWindowShortcut('1');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Backend' })
      ).toBeInTheDocument()
    );
  });
});
