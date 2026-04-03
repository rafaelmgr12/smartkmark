import {
  Bold,
  CheckSquare,
  Eye,
  EyeOff,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Strikethrough,
  Code2,
} from 'lucide-react';
import IconButton from '../ui/IconButton';
import type { EditorFontSize, LineWrapMode } from '../../types';
import type { EditorCommand } from './MarkdownEditor';

interface EditorToolbarProps {
  isPreviewOpen: boolean;
  fontSize: EditorFontSize;
  lineWrap: LineWrapMode;
  onTogglePreview: () => void;
  onCommand: (command: EditorCommand) => void;
  onFontSizeChange: (value: EditorFontSize) => void;
  onLineWrapChange: (value: LineWrapMode) => void;
}

export default function EditorToolbar({
  isPreviewOpen,
  fontSize,
  lineWrap,
  onTogglePreview,
  onCommand,
  onFontSizeChange,
  onLineWrapChange,
}: EditorToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b px-4 py-2"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <IconButton
        icon={Bold}
        title="Bold (Ctrl+B)"
        onClick={() => onCommand('bold')}
      />
      <IconButton
        icon={Italic}
        title="Italic (Ctrl+I)"
        onClick={() => onCommand('italic')}
      />
      <IconButton
        icon={Strikethrough}
        title="Strikethrough"
        onClick={() => onCommand('strikethrough')}
      />

      <div className="mx-2 h-5 w-px" style={{ background: 'var(--border-subtle)' }} />

      <IconButton
        icon={Link}
        title="Link (Ctrl+K)"
        onClick={() => onCommand('link')}
      />
      <IconButton
        icon={Image}
        title="Image"
        onClick={() => onCommand('image')}
      />
      <IconButton
        icon={Code2}
        title="Code block"
        onClick={() => onCommand('code')}
      />
      <IconButton
        icon={Sigma}
        title="Inline math"
        onClick={() => onCommand('inline-math')}
      />

      <div className="mx-2 h-5 w-px" style={{ background: 'var(--border-subtle)' }} />

      <IconButton
        icon={List}
        title="Bullet list"
        onClick={() => onCommand('bullet-list')}
      />
      <IconButton
        icon={ListOrdered}
        title="Numbered list"
        onClick={() => onCommand('number-list')}
      />
      <IconButton
        icon={CheckSquare}
        title="Task list"
        onClick={() => onCommand('task-list')}
      />
      <IconButton
        icon={Quote}
        title="Blockquote"
        onClick={() => onCommand('quote')}
      />

      <button
        type="button"
        className="ghost-button px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
        onClick={() => onCommand('callout')}
      >
        ! Note
      </button>
      <button
        type="button"
        className="ghost-button px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
        onClick={() => onCommand('math-block')}
      >
        $$ Block
      </button>
      <IconButton
        icon={Minus}
        title="Horizontal rule"
        onClick={() => onCommand('hr')}
      />

      <div className="flex-1" />

      <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
        Font
        <select
          value={fontSize}
          onChange={(event) => onFontSizeChange(event.target.value as EditorFontSize)}
          className="rounded-lg border bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <option value="sm">Compact</option>
          <option value="md">Balanced</option>
          <option value="lg">Large</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">
        Wrap
        <select
          value={lineWrap}
          onChange={(event) => onLineWrapChange(event.target.value as LineWrapMode)}
          className="rounded-lg border bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <option value="wrap">Soft wrap</option>
          <option value="scroll">Horizontal</option>
        </select>
      </label>

      <IconButton
        icon={isPreviewOpen ? EyeOff : Eye}
        title={isPreviewOpen ? 'Hide preview (Ctrl+E)' : 'Show preview (Ctrl+E)'}
        active={isPreviewOpen}
        onClick={onTogglePreview}
      />
    </div>
  );
}
