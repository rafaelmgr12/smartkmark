import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import { Hash } from 'lucide-react';
import { extractHeadings, getCodeLanguage } from '../../lib/markdown';

interface NoteContentProps {
  content: string;
}

function normalizeCallouts(content: string) {
  return content.replace(
    /^> \[!(NOTE|TIP|WARNING)\]\s*$/gim,
    (_value, kind: string) => `> **${kind.toUpperCase()}**`
  );
}

function flattenText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => flattenText(child)).join('');
  }

  if (node && typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode };
    return flattenText(props.children ?? '');
  }

  return '';
}

function MarkdownCodeBlock({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const language = getCodeLanguage(className);
  const plainText = flattenText(children).replace(/\n$/, '');

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span>{language}</span>
        <button
          type="button"
          className="code-block__copy"
          onClick={() => {
            void navigator.clipboard.writeText(plainText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function Heading({
  level,
  id,
  children,
}: {
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  id?: string;
  children: ReactNode;
}) {
  const Tag = level;

  return (
    <Tag id={id}>
      {children}
      {id ? (
        <a
          href={`#${id}`}
          className="markdown-heading-anchor"
          aria-label={`Link to ${flattenText(children)}`}
        >
          <Hash size={14} />
        </a>
      ) : null}
    </Tag>
  );
}

export default function NoteContent({ content }: NoteContentProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const normalizedContent = useMemo(() => normalizeCallouts(content), [content]);

  const components: Components = {
    code({ className, children }) {
      const isInline = !className && !flattenText(children).includes('\n');

      if (isInline) {
        return <code className={className}>{children}</code>;
      }

      return <MarkdownCodeBlock className={className}>{children}</MarkdownCodeBlock>;
    },
    blockquote({ children }) {
      const flattened = flattenText(children);
      const kind = flattened.match(/^(NOTE|TIP|WARNING)/)?.[1]?.toLowerCase();

      if (!kind) {
        return <blockquote>{children}</blockquote>;
      }

      return (
        <aside className="markdown-callout" data-callout={kind}>
          <div className="markdown-callout__title">{kind}</div>
          <div>{children}</div>
        </aside>
      );
    },
    h1({ node, children }) {
      return (
        <Heading level="h1" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
    h2({ node, children }) {
      return (
        <Heading level="h2" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
    h3({ node, children }) {
      return (
        <Heading level="h3" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
    h4({ node, children }) {
      return (
        <Heading level="h4" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
    h5({ node, children }) {
      return (
        <Heading level="h5" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
    h6({ node, children }) {
      return (
        <Heading level="h6" id={String(node?.properties?.id ?? '')}>
          {children}
        </Heading>
      );
    },
  };

  return (
    <div className="flex h-full gap-5 overflow-hidden px-5 py-5">
      <div className="min-w-0 flex-1 overflow-y-auto pr-2">
        <article className="markdown-preview">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeSlug, rehypeHighlight]}
            components={components}
          >
            {normalizedContent}
          </ReactMarkdown>
        </article>
      </div>

      <aside className="hidden w-56 shrink-0 overflow-y-auto xl:block">
        <div className="markdown-outline">
          <div className="markdown-outline__title">Outline</div>
          {headings.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">
              Add headings to navigate long notes.
            </p>
          ) : (
            headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className="markdown-outline__link"
                style={{ paddingLeft: `${0.75 + (heading.depth - 1) * 0.5}rem` }}
              >
                {heading.text}
              </a>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
