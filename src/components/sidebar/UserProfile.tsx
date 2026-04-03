import { RefreshCw } from 'lucide-react';

interface UserProfileProps {
  name: string;
  syncedAt?: string;
}

export default function UserProfile({ name, syncedAt }: UserProfileProps) {
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
    </div>
  );
}
