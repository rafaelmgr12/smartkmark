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
  const borderColor = active
    ? 'var(--nav-item-active-border)'
    : 'var(--nav-item-border)';
  const background = active ? 'var(--nav-item-active-bg)' : 'transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition"
      data-active={active}
      aria-pressed={active}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.background = 'var(--nav-item-hover-bg)';
          event.currentTarget.style.borderColor = 'var(--border-subtle)';
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.background = background;
          event.currentTarget.style.borderColor = borderColor;
        }
      }}
      title={label}
      style={{
        paddingLeft: `${0.5 + depth * 1}rem`,
        borderColor,
        background,
      }}
    >
      <Icon
        size={16}
        className="shrink-0"
        style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}
      />
      <span
        className="truncate"
        style={{ color: active ? 'var(--text-1)' : 'var(--text-2)' }}
      >
        {label}
      </span>
      {count !== undefined && <CountBadge count={count} />}
    </button>
  );
}
