export interface Notebook {
  id: string;
  name: string;
  icon?: string;
}

export interface NoteTag {
  id: string;
  label: string;
  color: 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'gray';
}

export interface Note {
  id: string;
  title: string;
  body: string;
  notebookId: string;
  tags: NoteTag[];
  updatedAt: string;
  pinned?: boolean;
}

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
  children?: SidebarNavItem[];
}

export type StatusFilter = 'active' | 'onHold' | 'completed' | 'dropped';
