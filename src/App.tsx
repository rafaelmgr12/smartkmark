import { KeyboardEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Theme = 'light' | 'dark';

type OpenFileResult =
  | { canceled: true }
  | { canceled: false; filePath: string; content: string };

type SaveFileResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

const DEFAULT_MARKDOWN = `# SmartKMark\n\nEditor Markdown com preview em tempo real.\n\n- Abra arquivos com **Ctrl/Cmd + O**\n- Salve arquivos com **Ctrl/Cmd + S**\n- Suporte a ~~tachado~~ e tabelas:\n\n| Coluna A | Coluna B |\n| --- | --- |\n| 1 | 2 |\n`;

function App() {
  const [content, setContent] = useState(DEFAULT_MARKDOWN);
  const [filePath, setFilePath] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState<Theme>('light');
  const [status, setStatus] = useState('Pronto');

  const title = useMemo(() => {
    if (!filePath) return 'Sem arquivo aberto';
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1];
  }, [filePath]);

  const openFile = async () => {
    const result = (await window.desktopApi.openMarkdownFile()) as OpenFileResult;
    if (!result.canceled) {
      setFilePath(result.filePath);
      setContent(result.content);
      setStatus(`Arquivo aberto: ${result.filePath}`);
    }
  };

  const saveFile = async () => {
    const result = (await window.desktopApi.saveMarkdownFile({
      filePath,
      content
    })) as SaveFileResult;

    if (!result.canceled) {
      setFilePath(result.filePath);
      setStatus(`Arquivo salvo: ${result.filePath}`);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isMeta = event.ctrlKey || event.metaKey;
    if (!isMeta) return;

    if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      void openFile();
    }

    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveFile();
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex h-screen flex-col font-sans outline-none ${isDark ? 'dark bg-slate-900 text-slate-200' : 'bg-slate-50 text-slate-900'}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <header
        className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
      >
        <div>
          <h1 className="m-0 text-lg font-bold">SmartKMark</h1>
          <p className="mt-0.5 text-sm opacity-75">{title}</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${isDark ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-300 bg-white text-slate-900'}`}
            onClick={() => void openFile()}
          >
            Abrir (.md)
          </button>
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${isDark ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-300 bg-white text-slate-900'}`}
            onClick={() => void saveFile()}
          >
            Salvar (.md)
          </button>
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${isDark ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-slate-300 bg-white text-slate-900'}`}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Alternar tema"
          >
            Tema: {isDark ? 'Escuro' : 'Claro'}
          </button>
        </div>
      </header>

      {/* Panes */}
      <main className="grid min-h-0 flex-1 grid-cols-2">
        {/* Editor */}
        <section className={`flex min-h-0 flex-col border-r ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
          <h2
            className={`m-0 border-b px-4 py-3 text-sm font-semibold ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
          >
            Markdown
          </h2>
          <textarea
            className="h-full w-full flex-1 resize-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-inherit outline-none"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
          />
        </section>

        {/* Preview */}
        <section className="flex min-h-0 flex-col">
          <h2
            className={`m-0 border-b px-4 py-3 text-sm font-semibold ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
          >
            Preview
          </h2>
          <article
            className={`prose prose-github max-w-none flex-1 overflow-auto p-4 ${isDark ? 'prose-invert' : ''}`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </section>
      </main>

      {/* Status bar */}
      <footer
        className={`border-t px-3 py-1.5 text-xs ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
      >
        {status}
      </footer>
    </div>
  );
}

export default App;
