import { act, renderHook, waitFor } from '@testing-library/react';
import useAppState from './useAppState';
import { createDesktopApiMock } from '../test/mockDesktopApi';
import { createNotebook, createNote, createSettings } from '../test/factories';

describe('useAppState', () => {
  it('loads the workspace and filters pinned notes', async () => {
    const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
    const backend = createNotebook({ id: 'Backend', name: 'Backend' });
    const pinned = createNote({
      id: 'note-pinned',
      title: 'Pinned API Guide',
      notebookId: backend.id,
      pinned: true,
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    const regular = createNote({
      id: 'note-regular',
      title: 'Regular note',
      notebookId: inbox.id,
      updatedAt: '2026-01-01T09:00:00.000Z',
    });

    const desktop = createDesktopApiMock({
      notebooks: [inbox, backend],
      notes: [regular, pinned],
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notes.map((note) => note.id)).toEqual([
      pinned.id,
      regular.id,
    ]);

    act(() => {
      result.current.setFilter('pinned');
    });

    expect(result.current.filterTitle).toBe('Pinned Notes');
    expect(result.current.filteredNotes.map((note) => note.id)).toEqual([pinned.id]);
  });

  it('surfaces load failures and clears the error', async () => {
    const desktop = createDesktopApiMock();
    desktop.mocks.getProfile.mockRejectedValueOnce(new Error('Desktop unavailable'));
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());

    await waitFor(() =>
      expect(result.current.error).toBe('Desktop unavailable')
    );

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('loads a selected note from the desktop API', async () => {
    const note = createNote({
      id: 'note-1',
      title: 'Integration state',
      notebookId: 'Inbox',
      body: 'Selected note body',
    });
    const desktop = createDesktopApiMock({
      notes: [note],
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.selectNote(note.id);
    });

    expect(desktop.mocks.getNote).toHaveBeenCalledWith('Inbox', note.id);
    expect(result.current.activeNote?.body).toBe('Selected note body');
    expect(result.current.selectedNoteId).toBe(note.id);
  });

  it('handles notebook create, rename, and delete flows', async () => {
    const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
    const note = createNote({
      id: 'note-1',
      title: 'Notebook flow',
      notebookId: 'Inbox',
    });
    const desktop = createDesktopApiMock({
      notebooks: [inbox],
      notes: [note],
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createNotebook('Drafts');
    });

    expect(result.current.notebooks.map((entry) => entry.id)).toContain('Drafts');
    expect(result.current.activeFilter).toBe('Drafts');

    await act(async () => {
      await result.current.renameNotebook('Drafts', 'Backend Notes');
    });

    expect(result.current.notebooks.map((entry) => entry.id)).toContain(
      'Backend Notes'
    );

    await act(async () => {
      await result.current.deleteNotebook('Backend Notes');
    });

    expect(
      result.current.notebooks.map((entry) => entry.id)
    ).not.toContain('Backend Notes');
    expect(result.current.activeFilter).toBe('all');
  });

  it('handles note lifecycle operations including move and pin', async () => {
    const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
    const backend = createNotebook({ id: 'Backend', name: 'Backend' });
    const existing = createNote({
      id: 'existing-note',
      title: 'Existing note',
      notebookId: 'Inbox',
      body: 'Initial body',
    });
    const desktop = createDesktopApiMock({
      notebooks: [inbox, backend],
      notes: [existing],
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.selectNote(existing.id);
      await result.current.createNote({
        notebookId: inbox.id,
        title: 'Created note',
        body: 'Draft',
      });
    });

    const createdId = result.current.selectedNoteId;
    expect(createdId).not.toBeNull();
    expect(result.current.activeFilter).toBe(inbox.id);

    await act(async () => {
      await result.current.updateNote({
        id: createdId!,
        notebookId: inbox.id,
        title: 'Created note updated',
        body: 'Updated body',
        status: 'completed',
      });
      await result.current.togglePin(createdId!);
    });

    act(() => {
      result.current.setFilter('pinned');
    });

    expect(result.current.filteredNotes.map((note) => note.id)).toContain(createdId);

    act(() => {
      result.current.setFilter(inbox.id);
    });

    await act(async () => {
      await result.current.moveNote(createdId!, inbox.id, backend.id);
    });

    expect(
      result.current.notes.find((note) => note.id === createdId)?.notebookId
    ).toBe(backend.id);

    await act(async () => {
      await result.current.deleteNote(backend.id, createdId!);
    });

    expect(result.current.notes.map((note) => note.id)).not.toContain(createdId);
  });

  it('moves deleted notes into trash and restores them back to a notebook', async () => {
    const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
    const note = createNote({
      id: 'trash-note',
      title: 'Trash flow',
      notebookId: inbox.id,
      body: 'Recover me',
    });
    const desktop = createDesktopApiMock({
      notebooks: [inbox],
      notes: [note],
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteNote(inbox.id, note.id);
    });

    act(() => {
      result.current.setFilter('trash');
    });

    expect(result.current.filteredNotes.map((entry) => entry.id)).toContain(note.id);

    await act(async () => {
      await result.current.restoreNote(note.id);
    });

    expect(result.current.activeFilter).toBe(inbox.id);
    expect(result.current.notes.map((entry) => entry.id)).toContain(note.id);
    expect(result.current.trashNotes.map((entry) => entry.id)).not.toContain(note.id);
  });

  it('patches settings and keeps the latest values', async () => {
    const desktop = createDesktopApiMock({
      settings: createSettings({
        previewOpen: true,
        layoutMode: 'workbench',
      }),
    });
    window.desktopApi = desktop.api;

    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.patchSettings({
        previewOpen: false,
        layoutMode: 'editor',
      });
    });

    expect(result.current.settings.previewOpen).toBe(false);
    expect(result.current.settings.layoutMode).toBe('editor');
  });
});
