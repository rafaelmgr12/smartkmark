interface CountBadgeProps {
  count: number;
  className?: string;
}

export default function CountBadge({ count, className = '' }: CountBadgeProps) {
  return (
    <span
      className={`ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${className}`}
      style={{
        background: 'rgba(17, 36, 49, 0.8)',
        borderColor: 'rgba(103, 134, 154, 0.18)',
        color: 'var(--text-3)',
      }}
    >
      {count}
    </span>
  );
}
