import { describe, expect, it } from 'vitest';
import {
  UNKNOWN_DESKTOP_ERROR,
  getErrorMessage,
  isDesktopError,
} from './desktop-errors';

describe('desktop-errors', () => {
  it('detects a desktop error shape', () => {
    expect(
      isDesktopError({
        code: 'NOT_FOUND',
        message: 'Missing note',
      })
    ).toBe(true);
  });

  it('rejects non desktop error values', () => {
    expect(isDesktopError('boom')).toBe(false);
    expect(isDesktopError({ code: 'NOT_FOUND' })).toBe(false);
  });

  it('prefers desktop error messages over the fallback', () => {
    expect(
      getErrorMessage(
        { code: 'WRITE_ERROR', message: 'Disk is read-only' },
        'Fallback message'
      )
    ).toBe('Disk is read-only');
  });

  it('uses regular error messages when available', () => {
    expect(getErrorMessage(new Error('Unexpected failure'), 'Fallback')).toBe(
      'Unexpected failure'
    );
  });

  it('falls back when the value is unknown', () => {
    expect(getErrorMessage(null, UNKNOWN_DESKTOP_ERROR.message)).toBe(
      UNKNOWN_DESKTOP_ERROR.message
    );
  });
});
