import type { LucideIcon } from 'lucide-react';
import CountBadge from '../ui/CountBadge';

interface SidebarItemProps {
  label: string;
  icon: LucideIcon;
  count?: number;
  active?: boolean;
  depth?: number;
  onClick?: () => void;
}

export default function SidebarItem({
  label,
  icon: Icon,
  count,
  active = false,
  depth = 0,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-slate-700/60 text-slate-100'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
      }`}
      style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
      {count !== undefined && <CountBadge count={count} />}
    </button>
  );
}
