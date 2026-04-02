import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NoteContentProps {
  content: string;
}

export default function NoteContent({ content }: NoteContentProps) {
  return (
    <article className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto px-5 py-4 prose-headings:text-slate-200 prose-p:text-slate-300 prose-a:text-indigo-400 prose-strong:text-slate-200 prose-code:rounded prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-emerald-400 prose-pre:bg-slate-900/80 prose-pre:text-slate-300 prose-li:text-slate-300 prose-h1:border-b prose-h1:border-slate-700 prose-h1:pb-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
