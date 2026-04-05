import type { ReactNode } from 'react';
import type { UpdateStatus } from '../../types';

interface UpdateBannerProps {
  status: UpdateStatus | null;
  onRestart: () => Promise<void>;
  onDismissError: () => void;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export default function UpdateBanner({
  status,
  onRestart,
  onDismissError,
}: UpdateBannerProps) {
  if (!status || status.state === 'checking') {
    return null;
  }

  let title = '';
  let description = '';
  let action: ReactNode = null;

  if (status.state === 'available') {
    title = 'Update available';
    description = `Downloading SmartKMark ${status.version} in the background.`;
  }

  if (status.state === 'downloading') {
    title = 'Downloading update';
    description = `SmartKMark ${status.version} is ${formatPercent(status.percent)} ready.`;
  }

  if (status.state === 'downloaded') {
    title = 'Update ready';
    description = `SmartKMark ${status.version} was downloaded and is ready to install.`;
    action = (
      <button
        type="button"
        className="rounded-full bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-app)]"
        onClick={() => void onRestart()}
      >
        Restart to update
      </button>
    );
  }

  if (status.state === 'error') {
    title = 'Update check failed';
    description = status.message;
    action = (
      <button
        type="button"
        className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-1)]"
        onClick={onDismissError}
      >
        Dismiss
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute right-6 top-20 z-30 flex max-w-sm justify-end">
      <div
        className="pointer-events-auto rounded-[22px] border border-[var(--border-subtle)] px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur"
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface-elevated) 95%, transparent)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
          {title}
        </p>
        <p className="mt-2 text-sm text-[var(--text-1)]">{description}</p>
        {action ? <div className="mt-3 flex justify-end">{action}</div> : null}
      </div>
    </div>
  );
}
