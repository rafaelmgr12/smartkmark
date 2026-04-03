import type { NoteTag } from '../../types';

const COLOR_MAP: Record<NoteTag['color'], string> = {
  green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  orange: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  blue: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  purple: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300',
  red: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  gray: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

interface BadgeProps {
  label: string;
  color?: NoteTag['color'];
  className?: string;
}

export default function Badge({ label, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${COLOR_MAP[color]} ${className}`}
    >
      {label}
    </span>
  );
}
