import type { DesktopError } from '../types';

export const UNKNOWN_DESKTOP_ERROR: DesktopError = {
  code: 'UNKNOWN_ERROR',
  message: 'Something went wrong while talking to the desktop layer.',
  recoverable: true,
};

export function isDesktopError(value: unknown): value is DesktopError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  );
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isDesktopError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
