import { AppError, DEFAULT_SETTINGS, type AppSettings } from './storage-core';
import {
  SETTINGS_FONT_SIZE_VALUES,
  SETTINGS_LAYOUT_VALUES,
  SETTINGS_LINE_WRAP_VALUES,
  SETTINGS_THEME_VALUES,
  errorDetails,
  isRecord,
  readJsonFile,
  readUnionValue,
  workspacePaths,
  writeJsonFile,
} from './storage-shared';

function normalizeSettings(value: unknown): AppSettings {
  const raw = isRecord(value) ? value : {};

  return {
    theme: readUnionValue(raw.theme, SETTINGS_THEME_VALUES, DEFAULT_SETTINGS.theme),
    layoutMode: readUnionValue(
      raw.layoutMode,
      SETTINGS_LAYOUT_VALUES,
      DEFAULT_SETTINGS.layoutMode
    ),
    editorFontSize: readUnionValue(
      raw.editorFontSize,
      SETTINGS_FONT_SIZE_VALUES,
      DEFAULT_SETTINGS.editorFontSize
    ),
    lineWrap: readUnionValue(
      raw.lineWrap,
      SETTINGS_LINE_WRAP_VALUES,
      DEFAULT_SETTINGS.lineWrap
    ),
    previewOpen:
      typeof raw.previewOpen === 'boolean'
        ? raw.previewOpen
        : DEFAULT_SETTINGS.previewOpen,
  };
}

export async function getSettings(baseDir: string): Promise<AppSettings> {
  const settings = await readJsonFile(
    workspacePaths(baseDir).settingsFile,
    (value) => normalizeSettings(value)
  );

  return settings ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  baseDir: string,
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings(baseDir);
  const next = normalizeSettings({ ...current, ...patch });

  try {
    await writeJsonFile(workspacePaths(baseDir).settingsFile, next);
    return next;
  } catch (error) {
    throw new AppError('WRITE_ERROR', 'Unable to save application settings.', {
      details: errorDetails(error),
    });
  }
}
