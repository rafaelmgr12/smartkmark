import path from 'node:path';
import {
  AppError,
  type AppSettings,
  type NoteStatus,
  type NoteTag,
} from './storage-core';

const SETTINGS_PATCH_KEYS = [
  'theme',
  'layoutMode',
  'editorFontSize',
  'lineWrap',
  'previewOpen',
  'spellcheckLocale',
] as const satisfies readonly (keyof AppSettings)[];
const NOTES_CREATE_KEYS = ['notebookId', 'title', 'body'] as const;
const NOTES_UPDATE_KEYS = [
  'id',
  'notebookId',
  'title',
  'body',
  'tags',
  'pinned',
  'status',
] as const;
const PATH_SEPARATOR_PATTERN = /[\\/]/;

export type Schema<T> = {
  parse: (input: unknown) => T;
};

function schemaError(message: string): never {
  throw new AppError('VALIDATION_ERROR', message);
}

function parseObjectRecord(input: unknown, message: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    schemaError(message);
  }

  return input as Record<string, unknown>;
}

function assertOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  message: (key: string) => string
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      schemaError(message(key));
    }
  }
}

function parseSafeId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    schemaError(`${label} must be a non-empty string.`);
  }

  if (path.isAbsolute(input) || PATH_SEPARATOR_PATTERN.test(input) || input.includes('..')) {
    schemaError(`${label} contains invalid path characters.`);
  }

  return input;
}

export const nonEmptyStringSchema: Schema<string> = {
  parse(input) {
    if (typeof input !== 'string' || input.trim().length === 0) {
      schemaError('Expected a non-empty string.');
    }

    return input;
  },
};

export const safeNotebookIdSchema: Schema<string> = {
  parse(input) {
    return parseSafeId(input, 'Notebook ID');
  },
};

export const safeNoteIdSchema: Schema<string> = {
  parse(input) {
    return parseSafeId(input, 'Note ID');
  },
};

export const noteStatusSchema: Schema<NoteStatus> = {
  parse(input) {
    if (
      input !== 'active' &&
      input !== 'onHold' &&
      input !== 'completed' &&
      input !== 'dropped'
    ) {
      schemaError('Invalid note status.');
    }

    return input;
  },
};

export const noteTagSchema: Schema<NoteTag> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected a note tag object.');
    assertOnlyAllowedKeys(value, ['label', 'color'], () => 'Unexpected fields in note tag payload.');

    return {
      label: typeof value.label === 'string' ? value.label : schemaError('Expected tag label string.'),
      color: typeof value.color === 'string' ? value.color : schemaError('Expected tag color string.'),
    };
  },
};

export const settingsPatchSchema: Schema<Partial<AppSettings>> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected settings patch object.');
    assertOnlyAllowedKeys(value, SETTINGS_PATCH_KEYS, (key) => `Unexpected settings field: ${key}.`);

    if (
      value.theme !== undefined &&
      value.theme !== 'workbench-dark' &&
      value.theme !== 'workbench-light'
    ) {
      schemaError('Invalid settings.theme value.');
    }

    if (
      value.layoutMode !== undefined &&
      value.layoutMode !== 'workbench' &&
      value.layoutMode !== 'writer' &&
      value.layoutMode !== 'editor'
    ) {
      schemaError('Invalid settings.layoutMode value.');
    }

    if (
      value.editorFontSize !== undefined &&
      value.editorFontSize !== 'sm' &&
      value.editorFontSize !== 'md' &&
      value.editorFontSize !== 'lg'
    ) {
      schemaError('Invalid settings.editorFontSize value.');
    }

    if (
      value.lineWrap !== undefined &&
      value.lineWrap !== 'wrap' &&
      value.lineWrap !== 'scroll'
    ) {
      schemaError('Invalid settings.lineWrap value.');
    }

    if (value.previewOpen !== undefined && typeof value.previewOpen !== 'boolean') {
      schemaError('Invalid settings.previewOpen value.');
    }

    if (
      value.spellcheckLocale !== undefined &&
      value.spellcheckLocale !== 'pt-BR' &&
      value.spellcheckLocale !== 'es-ES' &&
      value.spellcheckLocale !== 'en-US'
    ) {
      schemaError('Invalid settings.spellcheckLocale value.');
    }

    return value as Partial<AppSettings>;
  },
};

export function tupleSchema<T extends unknown[]>(
  ...schemas: { [K in keyof T]: Schema<T[K]> }
): Schema<T> {
  return {
    parse(input) {
      if (!Array.isArray(input) || input.length !== schemas.length) {
        schemaError(`Expected ${schemas.length} argument(s).`);
      }

      return schemas.map((schema, index) => schema.parse(input[index])) as T;
    },
  };
}

export const notesCreateSchema: Schema<{
  notebookId: string;
  title: string;
  body?: string;
}> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected notes:create payload object.');
    assertOnlyAllowedKeys(value, NOTES_CREATE_KEYS, () => 'Unexpected fields in notes:create payload.');

    const notebookId = safeNotebookIdSchema.parse(value.notebookId);

    if (typeof value.title !== 'string' || value.title.trim().length === 0) {
      schemaError('notes:create title must be a non-empty string.');
    }

    if (value.body !== undefined && typeof value.body !== 'string') {
      schemaError('notes:create body must be a string when provided.');
    }

    return {
      notebookId,
      title: value.title,
      ...(value.body !== undefined ? { body: value.body } : {}),
    };
  },
};

export const notesUpdateSchema: Schema<{
  id: string;
  notebookId: string;
  title?: string;
  body?: string;
  tags?: NoteTag[];
  pinned?: boolean;
  status?: NoteStatus;
}> = {
  parse(input) {
    const value = parseObjectRecord(input, 'Expected notes:update payload object.');
    assertOnlyAllowedKeys(
      value,
      NOTES_UPDATE_KEYS,
      (key) => `Unexpected fields in notes:update payload: ${key}.`
    );

    const id = safeNoteIdSchema.parse(value.id);
    const notebookId = safeNotebookIdSchema.parse(value.notebookId);

    if (value.title !== undefined && typeof value.title !== 'string') {
      schemaError('notes:update title must be a string when provided.');
    }

    if (value.body !== undefined && typeof value.body !== 'string') {
      schemaError('notes:update body must be a string when provided.');
    }

    if (value.pinned !== undefined && typeof value.pinned !== 'boolean') {
      schemaError('notes:update pinned must be a boolean when provided.');
    }

    if (value.status !== undefined) {
      noteStatusSchema.parse(value.status);
    }

    if (value.tags !== undefined) {
      if (!Array.isArray(value.tags)) {
        schemaError('notes:update tags must be an array when provided.');
      }

      value.tags.forEach((tag) => noteTagSchema.parse(tag));
    }

    return {
      id,
      notebookId,
      ...(value.title !== undefined ? { title: value.title } : {}),
      ...(value.body !== undefined ? { body: value.body } : {}),
      ...(value.tags !== undefined ? { tags: value.tags as NoteTag[] } : {}),
      ...(value.pinned !== undefined ? { pinned: value.pinned } : {}),
      ...(value.status !== undefined ? { status: value.status as NoteStatus } : {}),
    };
  },
};

export const notesRestoreSchema: Schema<[string, string | undefined]> = {
  parse(input) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 2) {
      schemaError('Expected 1 or 2 argument(s).');
    }

    const [noteId, notebookId] = input;
    const parsedNoteId = safeNoteIdSchema.parse(noteId);

    if (notebookId !== undefined) {
      return [parsedNoteId, safeNotebookIdSchema.parse(notebookId)];
    }

    return [parsedNoteId, undefined];
  },
};
