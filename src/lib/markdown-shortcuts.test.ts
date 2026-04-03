import { describe, expect, it } from 'vitest';
import {
  insertCallout,
  insertInlineMath,
  insertMathBlock,
  wrapSelection,
} from './markdown-shortcuts';

describe('markdown shortcuts', () => {
  it('wraps the current selection', () => {
    expect(
      wrapSelection(
        {
          value: 'hello world',
          selectionStart: 6,
          selectionEnd: 11,
        },
        '**'
      )
    ).toEqual({
      value: 'hello **world**',
      selectionStart: 8,
      selectionEnd: 13,
    });
  });

  it('inserts inline math markers', () => {
    expect(
      insertInlineMath({
        value: 'Energy',
        selectionStart: 0,
        selectionEnd: 6,
      })
    ).toEqual({
      value: '$Energy$',
      selectionStart: 1,
      selectionEnd: 7,
    });
  });

  it('creates a math block', () => {
    expect(
      insertMathBlock({
        value: '',
        selectionStart: 0,
        selectionEnd: 0,
      })
    ).toEqual({
      value: '\n$$\nE = mc^2\n$$\n',
      selectionStart: 4,
      selectionEnd: 12,
    });
  });

  it('creates a note callout', () => {
    expect(
      insertCallout(
        {
          value: 'Important context',
          selectionStart: 0,
          selectionEnd: 17,
        },
        'WARNING'
      ).value
    ).toContain('> [!WARNING]');
  });
});
