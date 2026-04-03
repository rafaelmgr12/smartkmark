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
      data-active={active}
      className={`ghost-button justify-center p-2 ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}
