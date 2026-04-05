import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap, EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import type { SelectionState } from '../../lib/markdown-shortcuts';
import {
  applyMarkdownTransform,
  insertCallout,
  insertCodeBlock,
  insertHorizontalRule,
  insertImage,
  insertInlineMath,
  insertLink,
  insertMathBlock,
  numberedList,
  prefixLines,
  taskList,
  wrapSelection,
} from '../../lib/markdown-shortcuts';
import type { EditorFontSize, LineWrapMode } from '../../types';

export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'link'
  | 'image'
  | 'code'
  | 'bullet-list'
  | 'number-list'
  | 'task-list'
  | 'quote'
  | 'callout'
  | 'hr'
  | 'inline-math'
  | 'math-block';

export interface MarkdownEditorHandle {
  applyCommand: (command: EditorCommand) => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onTogglePreview: () => void;
  fontSize: EditorFontSize;
  lineWrap: LineWrapMode;
  spellcheckLocale: string;
}

const FONT_SIZE_MAP: Record<EditorFontSize, string> = {
  sm: '13px',
  md: '14px',
  lg: '16px',
};

const EDITOR_THEME = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    padding: '1rem 1.25rem 1.5rem',
    minHeight: '100%',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
  },
  '.cm-panels': {
    backgroundColor: 'transparent',
    color: 'var(--text-2)',
  },
  '.cm-placeholder': {
    color: 'var(--text-dim)',
  },
});

function commandTransform(command: EditorCommand) {
  switch (command) {
    case 'bold':
      return (state: SelectionState) => wrapSelection(state, '**');
    case 'italic':
      return (state: SelectionState) => wrapSelection(state, '_');
    case 'strikethrough':
      return (state: SelectionState) => wrapSelection(state, '~~');
    case 'link':
      return insertLink;
    case 'image':
      return insertImage;
    case 'code':
      return insertCodeBlock;
    case 'bullet-list':
      return (state: SelectionState) => prefixLines(state, '- ');
    case 'number-list':
      return numberedList;
    case 'task-list':
      return taskList;
    case 'quote':
      return (state: SelectionState) => prefixLines(state, '> ');
    case 'callout':
      return (state: SelectionState) => insertCallout(state, 'NOTE');
    case 'hr':
      return insertHorizontalRule;
    case 'inline-math':
      return insertInlineMath;
    case 'math-block':
      return insertMathBlock;
    default:
      return (state: SelectionState) => state;
  }
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      value,
      onChange,
      onSave,
      onTogglePreview,
      fontSize,
      lineWrap,
      spellcheckLocale,
    },
    ref
  ) => {
    const viewRef = useRef<EditorView | null>(null);

    const applyCommand = useCallback((command: EditorCommand) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const selection = view.state.selection.main;
      const next = applyMarkdownTransform(
        {
          value: view.state.doc.toString(),
          selectionStart: selection.from,
          selectionEnd: selection.to,
        },
        commandTransform(command)
      );

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: next.value,
        },
        selection: {
          anchor: next.selectionStart,
          head: next.selectionEnd,
        },
      });
      view.focus();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        applyCommand,
        focus: () => {
          viewRef.current?.focus();
        },
      }),
      [applyCommand]
    );

    const extensions = useMemo(() => {
      const keyBindings = keymap.of([
        {
          key: 'Mod-b',
          run: () => {
            applyCommand('bold');
            return true;
          },
        },
        {
          key: 'Mod-i',
          run: () => {
            applyCommand('italic');
            return true;
          },
        },
        {
          key: 'Mod-k',
          run: () => {
            applyCommand('link');
            return true;
          },
        },
        {
          key: 'Mod-s',
          run: () => {
            onSave();
            return true;
          },
        },
        {
          key: 'Mod-e',
          run: () => {
            onTogglePreview();
            return true;
          },
        },
      ]);

      const spellcheckAttributes = EditorView.contentAttributes.of({
        spellcheck: 'true',
        lang: spellcheckLocale,
      });
      const shared = [markdown(), keyBindings, spellcheckAttributes, EDITOR_THEME];
      return lineWrap === 'wrap'
        ? [...shared, EditorView.lineWrapping]
        : shared;
    }, [applyCommand, lineWrap, onSave, onTogglePreview, spellcheckLocale]);

    return (
      <div className="h-full overflow-hidden">
        <CodeMirror
          value={value}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
          extensions={extensions}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          onChange={(nextValue) => {
            onChange(nextValue);
          }}
          style={{
            height: '100%',
            fontSize: FONT_SIZE_MAP[fontSize],
          }}
        />
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
