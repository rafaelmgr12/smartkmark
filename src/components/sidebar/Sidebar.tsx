import {
  FileText,
  Pin,
  BookOpen,
  Lightbulb,
  Monitor,
  Smartphone,
  Settings,
  Globe,
  FolderOpen,
  Inbox,
  GraduationCap,
  PenTool,
  Newspaper,
  Trash2,
  Activity,
  PauseCircle,
  CheckCircle,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import SidebarSection from './SidebarSection';
import UserProfile from './UserProfile';
import type { Notebook } from '../../types';

const NOTEBOOK_ICONS: Record<string, typeof FileText> = {
  'awesome-saas': BookOpen,
  'desktop-app': Monitor,
  ideas: Lightbulb,
  'mobile-app': Smartphone,
  operations: Settings,
  website: Globe,
};

interface SidebarProps {
  notebooks: Notebook[];
  activeItem: string;
  onItemClick: (id: string) => void;
  totalNotes: number;
}

export default function Sidebar({
  notebooks,
  activeItem,
  onItemClick,
  totalNotes,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-700/50 bg-slate-900">
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
        <SidebarItem
          label="All Notes"
          icon={FileText}
          count={totalNotes}
          active={activeItem === 'all'}
          onClick={() => onItemClick('all')}
        />
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        <SidebarSection title="Pinned Notes">
          <SidebarItem
            label="Pinned Notes"
            icon={Pin}
            active={activeItem === 'pinned'}
            onClick={() => onItemClick('pinned')}
          />
        </SidebarSection>

        <SidebarSection title="Notebooks">
          {notebooks.map((nb) => (
            <SidebarItem
              key={nb.id}
              label={nb.name}
              icon={NOTEBOOK_ICONS[nb.id] || FolderOpen}
              active={activeItem === nb.id}
              depth={1}
              onClick={() => onItemClick(nb.id)}
            />
          ))}
        </SidebarSection>

        <div className="space-y-0.5">
          <SidebarItem
            label="Empty"
            icon={FolderOpen}
            active={activeItem === 'empty'}
            onClick={() => onItemClick('empty')}
          />
          <SidebarItem
            label="Hobby"
            icon={Lightbulb}
            active={activeItem === 'hobby'}
            onClick={() => onItemClick('hobby')}
          />
          <SidebarItem
            label="Inbox"
            icon={Inbox}
            active={activeItem === 'inbox'}
            onClick={() => onItemClick('inbox')}
          />
          <SidebarItem
            label="Learn"
            icon={GraduationCap}
            active={activeItem === 'learn'}
            onClick={() => onItemClick('learn')}
          />
        </div>

        <SidebarSection title="Publishing">
          <SidebarItem
            label="Blog"
            icon={Newspaper}
            active={activeItem === 'blog'}
            depth={1}
            onClick={() => onItemClick('blog')}
          />
          <SidebarItem
            label="Tips"
            icon={PenTool}
            active={activeItem === 'tips'}
            depth={1}
            onClick={() => onItemClick('tips')}
          />
        </SidebarSection>

        <div className="space-y-0.5">
          <SidebarItem
            label="Trash"
            icon={Trash2}
            active={activeItem === 'trash'}
            onClick={() => onItemClick('trash')}
          />
        </div>

        <SidebarSection title="Status">
          <SidebarItem
            label="Active"
            icon={Activity}
            active={activeItem === 'active'}
            depth={1}
            onClick={() => onItemClick('active')}
          />
          <SidebarItem
            label="On Hold"
            icon={PauseCircle}
            active={activeItem === 'on-hold'}
            depth={1}
            onClick={() => onItemClick('on-hold')}
          />
          <SidebarItem
            label="Completed"
            icon={CheckCircle}
            active={activeItem === 'completed'}
            depth={1}
            onClick={() => onItemClick('completed')}
          />
        </SidebarSection>
      </nav>

      {/* User profile */}
      <UserProfile name="Takuya Matsuyama" syncedAt="11:32:00" />
    </aside>
  );
}
