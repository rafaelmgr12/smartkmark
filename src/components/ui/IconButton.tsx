import type { LucideIcon } from 'lucide-react';

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  size?: number;
  className?: string;
}

export default function IconButton({
  icon: Icon,
  onClick,
  title,
  active = false,
  size = 16,
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center rounded p-1.5 transition-colors hover:bg-slate-700 ${
        active ? 'bg-slate-700 text-slate-200' : 'text-slate-400'
      } ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}
