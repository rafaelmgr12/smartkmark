import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import MarkdownEditor from './MarkdownEditor';

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

describe('MarkdownEditor', () => {
  it('converts rich clipboard html into markdown on paste', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MarkdownEditor
        value=""
        onChange={onChange}
        onSave={vi.fn()}
        onTogglePreview={vi.fn()}
        fontSize="md"
        lineWrap="wrap"
        spellcheckLocale="en-US"
      />
    );

    const editor = container.querySelector('.cm-content');

    expect(editor).not.toBeNull();

    fireEvent.paste(editor as Element, {
      clipboardData: {
        getData(type: string) {
          if (type === 'text/html') {
            return '<p><strong>Hello</strong> <em>world</em> <a href="https://example.com">docs</a></p>';
          }

          if (type === 'text/plain') {
            return 'Hello world docs';
          }

          return '';
        },
      },
    });

    expect(onChange).toHaveBeenLastCalledWith(
      '**Hello** *world* [docs](https://example.com)'
    );
  });
});
