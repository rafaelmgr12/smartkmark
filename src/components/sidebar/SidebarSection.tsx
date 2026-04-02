import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function SidebarSection({
  title,
  children,
  defaultOpen = true,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-400"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}
