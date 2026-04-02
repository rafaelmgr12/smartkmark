import { RefreshCw } from 'lucide-react';

interface UserProfileProps {
  name: string;
  syncedAt?: string;
}

export default function UserProfile({ name, syncedAt }: UserProfileProps) {
  return (
    <div className="flex items-center gap-3 border-t border-slate-700/50 px-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-300">{name}</p>
        {syncedAt && (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <RefreshCw size={10} />
            Synced at {syncedAt}
          </p>
        )}
      </div>
    </div>
  );
}
