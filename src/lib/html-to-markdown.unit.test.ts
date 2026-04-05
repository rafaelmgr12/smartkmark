import { describe, expect, it } from 'vitest';
import {
  clipboardHtmlHasMarkdownFormatting,
  convertHtmlToMarkdown,
} from './html-to-markdown';

describe('html-to-markdown', () => {
  it('converts common rich text structures into markdown', () => {
    const html = [
      '<h2>Overview</h2>',
      '<p><strong>Ship</strong> <em>faster</em> with <a href="https://example.com">docs</a>.</p>',
      '<ul><li>First item</li><li>Second item</li></ul>',
      '<blockquote><p>Keep the structure</p></blockquote>',
      '<pre><code class="language-ts">const answer = 42;</code></pre>',
    ].join('');

    expect(convertHtmlToMarkdown(html)).toBe(
      [
        '## Overview',
        '',
        '**Ship** *faster* with [docs](https://example.com).',
        '',
        '- First item',
        '- Second item',
        '',
        '> Keep the structure',
        '',
        '```ts',
        'const answer = 42;',
        '```',
      ].join('\n')
    );
  });

  it('supports inline styles that imply markdown emphasis', () => {
    const html = '<p><span style="font-weight: 700">Bold</span> and <span style="font-style: italic">italic</span></p>';

    expect(convertHtmlToMarkdown(html)).toBe('**Bold** and *italic*');
  });

  it('detects when clipboard html contains meaningful formatting', () => {
    expect(clipboardHtmlHasMarkdownFormatting('<p><strong>Bold</strong></p>')).toBe(true);
    expect(
      clipboardHtmlHasMarkdownFormatting(
        '<p><span style="font-weight: 700">Bold</span></p>'
      )
    ).toBe(true);
    expect(clipboardHtmlHasMarkdownFormatting('<div><span>Plain text</span></div>')).toBe(
      false
    );
  });
});
