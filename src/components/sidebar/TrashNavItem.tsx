import { Trash2 } from 'lucide-react';
import SidebarItem from './SidebarItem';

interface TrashNavItemProps {
  active: boolean;
  count: number;
  onClick: () => void;
}

export default function TrashNavItem({ active, count, onClick }: TrashNavItemProps) {
  return (
    <SidebarItem
      label="Trash"
      icon={Trash2}
      count={count}
      active={active}
      onClick={onClick}
    />
  );
}
