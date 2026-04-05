import type {
  AppSettings,
  DesktopProfile,
  Note,
  NoteMeta,
  Notebook,
  NoteStatus,
  NoteTag,
  TagColor,
} from '../types';

export interface DesktopSeed {
  profile: DesktopProfile;
  notebooks: Notebook[];
  notes: Note[];
  settings: AppSettings;
}

let notebookCounter = 0;
let noteCounter = 0;

function nextNotebookId() {
  notebookCounter += 1;
  return `Notebook ${notebookCounter}`;
}

function nextNoteId() {
  noteCounter += 1;
  return `note-${noteCounter}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isoDate(offsetMinutes = 0) {
  return new Date(Date.UTC(2026, 0, 1, 12, offsetMinutes, 0)).toISOString();
}

export function createProfile(
  overrides: Partial<DesktopProfile> = {}
): DesktopProfile {
  return {
    fullName: 'Rafael Ribeiro',
    shortName: 'rafael',
    ...overrides,
  };
}

export function createSettings(
  overrides: Partial<AppSettings> = {}
): AppSettings {
  return {
    theme: 'workbench-dark',
    layoutMode: 'workbench',
    editorFontSize: 'md',
    lineWrap: 'wrap',
    previewOpen: true,
    spellcheckLocale: 'pt-BR',
    ...overrides,
  };
}

export function createNotebook(
  overrides: Partial<Notebook> = {}
): Notebook {
  const id = overrides.id ?? overrides.name ?? nextNotebookId();

  return {
    id,
    name: overrides.name ?? id,
  };
}

export function createTag(
  overrides: Partial<NoteTag> = {}
): NoteTag {
  return {
    label: overrides.label ?? 'api',
    color: overrides.color ?? 'blue',
    id: overrides.id,
  };
}

export function createNote(
  overrides: Partial<Note> = {}
): Note {
  const createdAt = overrides.createdAt ?? isoDate(noteCounter);
  const updatedAt = overrides.updatedAt ?? createdAt;
  const notebookId = overrides.notebookId ?? 'Inbox';
  const id = overrides.id ?? nextNoteId();

  return {
    id,
    title: overrides.title ?? `Note ${noteCounter}`,
    notebookId,
    tags: clone(overrides.tags ?? []),
    pinned: overrides.pinned ?? false,
    status: overrides.status ?? ('active' satisfies NoteStatus),
    createdAt,
    updatedAt,
    deletedAt: overrides.deletedAt,
    trashedFromNotebookId: overrides.trashedFromNotebookId,
    body: overrides.body ?? '',
  };
}

export function toNoteMeta(note: Note): NoteMeta {
  return {
    id: note.id,
    title: note.title,
    notebookId: note.notebookId,
    tags: clone(note.tags),
    pinned: note.pinned,
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    trashedFromNotebookId: note.trashedFromNotebookId,
  };
}

export function sortNotesByUpdatedAt<T extends Pick<NoteMeta, 'updatedAt'>>(
  notes: T[]
): T[] {
  return [...notes].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function createDesktopSeed(
  overrides: Partial<DesktopSeed> = {}
): DesktopSeed {
  return {
    profile: createProfile(overrides.profile),
    notebooks: clone(
      overrides.notebooks ?? [createNotebook({ id: 'Inbox', name: 'Inbox' })]
    ),
    notes: clone(overrides.notes ?? []),
    settings: createSettings(overrides.settings),
  };
}

export function createSeededWorkspace(): DesktopSeed {
  const inbox = createNotebook({ id: 'Inbox', name: 'Inbox' });
  const backend = createNotebook({ id: 'Backend', name: 'Backend' });
  const docs = createNotebook({ id: 'Docs', name: 'Docs' });

  return createDesktopSeed({
    notebooks: [inbox, backend, docs],
    notes: [
      createNote({
        id: 'note-inbox',
        title: 'SmartKMark Testing',
        notebookId: inbox.id,
        body: '# Inbox note',
        tags: [createTag({ label: 'qa', color: 'green' })],
        updatedAt: isoDate(2),
      }),
      createNote({
        id: 'note-backend',
        title: 'API Contracts',
        notebookId: backend.id,
        body: 'Document the desktop contract',
        tags: [createTag({ label: 'api', color: 'blue' })],
        updatedAt: isoDate(3),
      }),
      createNote({
        id: 'note-docs',
        title: 'Release Checklist',
        notebookId: docs.id,
        body: 'Prepare release notes',
        tags: [createTag({ label: 'release', color: 'orange' })],
        updatedAt: isoDate(1),
      }),
    ],
  });
}

export const TAG_COLORS: TagColor[] = [
  'blue',
  'green',
  'orange',
  'purple',
  'red',
  'gray',
];
