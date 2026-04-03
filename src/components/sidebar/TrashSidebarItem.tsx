import { Trash2 } from 'lucide-react';
import SidebarItem from './SidebarItem';

interface TrashSidebarItemProps {
  active: boolean;
  count: number;
  onClick: () => void;
}

export default function TrashSidebarItem({
  active,
  count,
  onClick,
}: TrashSidebarItemProps) {
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
