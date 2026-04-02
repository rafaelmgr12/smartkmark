import type { NoteTag } from '../../types';

const COLOR_MAP: Record<NoteTag['color'], string> = {
  green: 'bg-emerald-600/20 text-emerald-400',
  orange: 'bg-amber-600/20 text-amber-400',
  blue: 'bg-sky-600/20 text-sky-400',
  purple: 'bg-violet-600/20 text-violet-400',
  red: 'bg-rose-600/20 text-rose-400',
  gray: 'bg-slate-600/20 text-slate-400',
};

interface BadgeProps {
  label: string;
  color?: NoteTag['color'];
  className?: string;
}

export default function Badge({ label, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[color]} ${className}`}
    >
      {label}
    </span>
  );
}
