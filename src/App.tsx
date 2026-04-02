import { KeyboardEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

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

  return (
    <div className={`app ${theme}`} onKeyDown={handleKeyDown} tabIndex={0}>
      <header className="toolbar">
        <div>
          <h1>SmartKMark</h1>
          <p>{title}</p>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => void openFile()}>Abrir (.md)</button>
          <button onClick={() => void saveFile()}>Salvar (.md)</button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label="Alternar tema"
          >
            Tema: {theme === 'light' ? 'Claro' : 'Escuro'}
          </button>
        </div>
      </header>

      <main className="panes">
        <section className="pane editor-pane">
          <h2>Markdown</h2>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="pane preview-pane">
          <h2>Preview</h2>
          <article className="preview-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </section>
      </main>

      <footer className="statusbar">{status}</footer>
    </div>
  );
}

export default App;
