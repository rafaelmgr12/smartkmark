import { RefreshCw } from 'lucide-react';
import type { ThemeName } from '../../types';

interface UserProfileProps {
  name: string;
  theme: ThemeName;
  syncedAt?: string;
  onThemeChange: (theme: ThemeName) => void;
}

export default function UserProfile({
  name,
  theme,
  syncedAt,
  onThemeChange,
}: UserProfileProps) {
  return (
    <div
      className="border-t px-4 py-4"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-bold"
          style={{
            background:
              'linear-gradient(135deg, rgba(34, 211, 238, 0.82), rgba(56, 189, 248, 0.44))',
            color: '#03212a',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            {name}
          </p>
          {syncedAt && (
            <p
              className="flex items-center gap-1 text-[11px]"
              style={{ color: 'var(--text-dim)' }}
            >
              <RefreshCw size={10} />
              Local-first • active {syncedAt}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          Theme
        </span>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(event) => onThemeChange(event.target.value as ThemeName)}
          className="rounded-lg border bg-transparent px-2 py-1 text-xs text-[var(--text-2)] outline-none"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <option value="workbench-dark">Dark</option>
          <option value="workbench-light">Light</option>
        </select>
      </div>
    </div>
  );
}
