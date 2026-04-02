import type { RefObject } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Link,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Image,
  Minus,
  Eye,
  Edit3,
} from 'lucide-react';
import IconButton from '../ui/IconButton';
import {
  wrapSelection,
  prefixLines,
  numberedList,
  taskList,
  insertLink,
  insertImage,
  insertCodeBlock,
  insertHorizontalRule,
} from '../../lib/markdown-shortcuts';

interface EditorToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onContentChange: (value: string) => void;
  isPreview: boolean;
  onTogglePreview: () => void;
}

export default function EditorToolbar({
  textareaRef,
  onContentChange,
  isPreview,
  onTogglePreview,
}: EditorToolbarProps) {
  const apply = (
    fn: (el: HTMLTextAreaElement) => {
      value: string;
      selectionStart: number;
      selectionEnd: number;
    }
  ) => {
    const el = textareaRef.current;
    if (!el) return;
    const result = fn(el);
    onContentChange(result.value);
    // Restore selection after React re-renders the textarea
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-700/50 px-4 py-1.5">
      <IconButton
        icon={Bold}
        title="Bold (Ctrl+B)"
        onClick={() => apply((el) => wrapSelection(el, '**'))}
      />
      <IconButton
        icon={Italic}
        title="Italic (Ctrl+I)"
        onClick={() => apply((el) => wrapSelection(el, '_'))}
      />
      <IconButton
        icon={Strikethrough}
        title="Strikethrough"
        onClick={() => apply((el) => wrapSelection(el, '~~'))}
      />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton
        icon={Link}
        title="Link (Ctrl+K)"
        onClick={() => apply(insertLink)}
      />
      <IconButton
        icon={Image}
        title="Image"
        onClick={() => apply(insertImage)}
      />
      <IconButton
        icon={Code}
        title="Code block"
        onClick={() => apply(insertCodeBlock)}
      />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton
        icon={List}
        title="Bullet list"
        onClick={() => apply((el) => prefixLines(el, '- '))}
      />
      <IconButton
        icon={ListOrdered}
        title="Numbered list"
        onClick={() => apply(numberedList)}
      />
      <IconButton
        icon={CheckSquare}
        title="Task list"
        onClick={() => apply(taskList)}
      />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton
        icon={Quote}
        title="Blockquote"
        onClick={() => apply((el) => prefixLines(el, '> '))}
      />
      <IconButton
        icon={Minus}
        title="Horizontal rule"
        onClick={() => apply(insertHorizontalRule)}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Toggle preview / edit */}
      <IconButton
        icon={isPreview ? Edit3 : Eye}
        title={isPreview ? 'Edit (Ctrl+E)' : 'Preview (Ctrl+E)'}
        active={isPreview}
        onClick={onTogglePreview}
      />
    </div>
  );
}
