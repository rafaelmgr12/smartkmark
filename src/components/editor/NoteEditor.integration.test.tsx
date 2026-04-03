import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NoteEditor from './NoteEditor';
import {
  advanceDebounce,
  pressWindowShortcut,
} from '../../test/helpers';
import { createNotebook, createNote, createSettings } from '../../test/factories';

vi.mock('./MarkdownEditor', async () => {
  const React = await import('react');

  const MockMarkdownEditor = React.forwardRef<
    { applyCommand: (command: string) => void; focus: () => void },
    {
      value: string;
      onChange: (value: string) => void;
      onSave: () => void;
      onTogglePreview: () => void;
    }
  >(({ value, onChange, onSave, onTogglePreview }, ref) => {
    React.useImperativeHandle(ref, () => ({
      applyCommand: vi.fn(),
      focus: vi.fn(),
    }));

    return (
      <div>
        <textarea
          aria-label="Markdown editor"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" onClick={onSave}>
          Save editor
        </button>
        <button type="button" onClick={onTogglePreview}>
          Toggle preview
        </button>
      </div>
    );
  });

  MockMarkdownEditor.displayName = 'MockMarkdownEditor';

  return {
    default: MockMarkdownEditor,
  };
});

vi.mock('./NoteContent', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="note-preview">{content}</div>
  ),
}));

const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
const backend = createNotebook({ id: 'Backend', name: 'Backend' });

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderEditor(overrides: Partial<ComponentProps<typeof NoteEditor>> = {}) {
  const note =
    overrides.note ??
    createNote({
      id: 'note-1',
      title: 'Work log',
      notebookId: inbox.id,
      body: 'Initial body',
      updatedAt: '2026-01-01T12:00:00.000Z',
    });

  const onUpdateNote =
    overrides.onUpdateNote ??
    vi.fn().mockResolvedValue({
      ...note,
      body: note.body,
      title: note.title,
      updatedAt: '2026-01-01T12:01:00.000Z',
    });
  const onMoveNote =
    overrides.onMoveNote ??
    vi.fn().mockResolvedValue({
      ...note,
      notebookId: backend.id,
      updatedAt: '2026-01-01T12:02:00.000Z',
    });
  const onPatchSettings =
    overrides.onPatchSettings ??
    vi.fn().mockResolvedValue(createSettings({ previewOpen: false }));

  const view = render(
    <NoteEditor
      note={note}
      notebooks={[inbox, backend]}
      settings={createSettings()}
      onUpdateNote={onUpdateNote}
      onMoveNote={onMoveNote}
      onPatchSettings={onPatchSettings}
      {...overrides}
    />
  );

  return {
    ...view,
    note,
    onUpdateNote,
    onMoveNote,
    onPatchSettings,
  };
}

describe('NoteEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves the body after the debounce window', async () => {
    const { onUpdateNote } = renderEditor();

    fireEvent.change(screen.getByLabelText('Markdown editor'), {
      target: { value: 'Updated markdown body' },
    });

    expect(screen.getByText('Unsaved')).toBeInTheDocument();

    await advanceDebounce();
    await flushAsyncWork();

    expect(onUpdateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Updated markdown body',
        title: 'Work log',
      })
    );
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('saves immediately when the save shortcut is pressed', async () => {
    const { onUpdateNote } = renderEditor();

    fireEvent.change(screen.getByPlaceholderText('Note title...'), {
      target: { value: 'Work log revised' },
    });

    pressWindowShortcut('s');
    await flushAsyncWork();

    expect(onUpdateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Work log revised',
      })
    );
  });

  it('toggles preview from the keyboard shortcut', async () => {
    const { onPatchSettings } = renderEditor();

    pressWindowShortcut('e');
    await flushAsyncWork();

    expect(onPatchSettings).toHaveBeenCalledWith({ previewOpen: false });
  });

  it('rejects duplicate tags without persisting a new save', async () => {
    const { onUpdateNote } = renderEditor({
      note: createNote({
        id: 'note-2',
        title: 'Tags',
        notebookId: inbox.id,
        tags: [{ label: 'api', color: 'blue' }],
      }),
    });

    fireEvent.change(screen.getByLabelText('New tag name'), {
      target: { value: 'API' },
    });
    fireEvent.click(screen.getByTitle('Add tag'));

    expect(
      screen.getByText('Tag "API" already exists on this note.')
    ).toBeInTheDocument();
    expect(onUpdateNote).not.toHaveBeenCalled();
  });

  it('persists the latest draft before moving the note', async () => {
    const note = createNote({
      id: 'note-3',
      title: 'Move me',
      notebookId: inbox.id,
      body: 'Before move',
    });
    const onUpdateNote = vi.fn().mockResolvedValue({
      ...note,
      body: 'After move prep',
      updatedAt: '2026-01-01T12:01:00.000Z',
    });
    const onMoveNote = vi.fn().mockResolvedValue({
      ...note,
      notebookId: backend.id,
      body: 'After move prep',
      updatedAt: '2026-01-01T12:02:00.000Z',
    });

    renderEditor({
      note,
      onUpdateNote,
      onMoveNote,
    });

    fireEvent.change(screen.getByLabelText('Markdown editor'), {
      target: { value: 'After move prep' },
    });
    fireEvent.change(screen.getByLabelText('Move note to notebook'), {
      target: { value: backend.id },
    });
    await flushAsyncWork();

    expect(onMoveNote).toHaveBeenCalled();

    expect(onUpdateNote.mock.invocationCallOrder[0]).toBeLessThan(
      onMoveNote.mock.invocationCallOrder[0]
    );
  });

  it('shows an error when autosave fails', async () => {
    const { onUpdateNote } = renderEditor({
      onUpdateNote: vi.fn().mockResolvedValue(null),
    });

    fireEvent.change(screen.getByLabelText('Markdown editor'), {
      target: { value: 'Unpersisted body' },
    });

    await advanceDebounce();
    await flushAsyncWork();

    expect(onUpdateNote).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Unpersisted body' })
    );
    expect(
      screen.getByText(
        'Unable to save this note. Your changes are still in the editor.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('resets the draft when switching to another note', async () => {
    const first = createNote({
      id: 'note-4',
      title: 'First note',
      notebookId: inbox.id,
      body: 'First body',
      updatedAt: '2026-01-01T12:00:00.000Z',
    });
    const second = createNote({
      id: 'note-5',
      title: 'Second note',
      notebookId: backend.id,
      body: 'Second body',
      updatedAt: '2026-01-01T12:05:00.000Z',
    });

    const { rerender } = render(
      <NoteEditor
        note={first}
        notebooks={[inbox, backend]}
        settings={createSettings()}
        onUpdateNote={vi.fn().mockResolvedValue(first)}
        onMoveNote={vi.fn().mockResolvedValue(first)}
        onPatchSettings={vi.fn().mockResolvedValue(createSettings())}
      />
    );

    fireEvent.change(screen.getByLabelText('Markdown editor'), {
      target: { value: 'Edited first body' },
    });

    rerender(
      <NoteEditor
        note={second}
        notebooks={[inbox, backend]}
        settings={createSettings()}
        onUpdateNote={vi.fn().mockResolvedValue(second)}
        onMoveNote={vi.fn().mockResolvedValue(second)}
        onPatchSettings={vi.fn().mockResolvedValue(createSettings())}
      />
    );

    expect(screen.getByPlaceholderText('Note title...')).toHaveValue('Second note');
    expect(screen.getByLabelText('Markdown editor')).toHaveValue('Second body');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
