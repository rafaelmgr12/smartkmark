import { describe, expect, it } from 'vitest';
import { settingsPatchSchema } from './validators';

describe('settingsPatchSchema', () => {
  it.each(['pt-BR', 'es-ES', 'en-US'] as const)(
    'accepts supported spellcheck locale %s',
    (spellcheckLocale) => {
      expect(settingsPatchSchema.parse({ spellcheckLocale })).toEqual({
        spellcheckLocale,
      });
    }
  );

  it.each([
    '',
    'pt_BR',
    'pt-br',
    'fr-FR',
    null,
    123,
    true,
    [],
    {},
  ])('rejects invalid spellcheck locale %j', (spellcheckLocale) => {
    expect(() => settingsPatchSchema.parse({ spellcheckLocale })).toThrowError(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Invalid settings.spellcheckLocale value.',
      })
    );
  });
});
