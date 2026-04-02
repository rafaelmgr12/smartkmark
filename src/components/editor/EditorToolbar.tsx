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
  MoreHorizontal,
} from 'lucide-react';
import IconButton from '../ui/IconButton';

export default function EditorToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-700/50 px-4 py-1.5">
      <IconButton icon={Bold} title="Bold" />
      <IconButton icon={Italic} title="Italic" />
      <IconButton icon={Strikethrough} title="Strikethrough" />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton icon={Link} title="Link" />
      <IconButton icon={Image} title="Image" />
      <IconButton icon={Code} title="Code" />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton icon={List} title="Bullet list" />
      <IconButton icon={ListOrdered} title="Numbered list" />
      <IconButton icon={CheckSquare} title="Task list" />

      <div className="mx-1.5 h-4 w-px bg-slate-700" />

      <IconButton icon={Quote} title="Blockquote" />
      <IconButton icon={Minus} title="Horizontal rule" />
      <IconButton icon={MoreHorizontal} title="More" />
    </div>
  );
}
