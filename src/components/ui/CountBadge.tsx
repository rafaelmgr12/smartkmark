interface CountBadgeProps {
  count: number;
  className?: string;
}

export default function CountBadge({ count, className = '' }: CountBadgeProps) {
  return (
    <span
      className={`ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ${className}`}
    >
      {count}
    </span>
  );
}
