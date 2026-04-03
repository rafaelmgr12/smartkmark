import { render, screen } from '@testing-library/react';
import NoteContent from './NoteContent';

describe('NoteContent', () => {
  it('renders headings, callouts, code blocks, and math', async () => {
    render(
      <NoteContent
        content={[
          '# Title',
          '',
          '> [!NOTE]',
          '> Remember this',
          '',
          '```ts',
          'const answer = 42;',
          '```',
          '',
          '$E=mc^2$',
        ].join('\n')}
      />
    );

    expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByText(/remember this/i)).toBeInTheDocument();
    expect(screen.getByText(/copy/i)).toBeInTheDocument();
    expect(screen.getByText(/outline/i)).toBeInTheDocument();
    expect(document.querySelector('.katex')).not.toBeNull();
  });
});
