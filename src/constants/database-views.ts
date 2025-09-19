import { Table, LayoutGrid, Calendar, Grid3X3, LucideIcon } from 'lucide-react';

export const DATABASE_VIEW_TYPES = {
  TABLE: 'table',
  BOARD: 'board',
  CALENDAR: 'calendar',
  GALLERY: 'gallery',
} as const;

export type DatabaseViewType = (typeof DATABASE_VIEW_TYPES)[keyof typeof DATABASE_VIEW_TYPES];

export interface DatabaseViewConfig {
  id: DatabaseViewType;
  name: string;
  icon: LucideIcon;
  description: string;
  emptyState: {
    title: string;
    description: string;
    actionText?: string;
  };
}

export const DATABASE_VIEW_CONFIGS: Record<DatabaseViewType, DatabaseViewConfig> = {
  [DATABASE_VIEW_TYPES.TABLE]: {
    id: DATABASE_VIEW_TYPES.TABLE,
    name: 'Table',
    icon: Table,
    description: 'View your data in a structured table format',
    emptyState: {
      title: 'No entries yet',
      description: 'Get started by creating your first entry in this database.',
      actionText: 'Create entry',
    },
  },
  [DATABASE_VIEW_TYPES.BOARD]: {
    id: DATABASE_VIEW_TYPES.BOARD,
    name: 'Board',
    icon: LayoutGrid,
    description: 'Organize entries in a kanban-style board',
    emptyState: {
      title: 'No entries to organize',
      description: 'Create entries to see them organized in columns by status.',
      actionText: 'Create entry',
    },
  },
  [DATABASE_VIEW_TYPES.CALENDAR]: {
    id: DATABASE_VIEW_TYPES.CALENDAR,
    name: 'Calendar',
    icon: Calendar,
    description: 'View entries in a calendar timeline',
    emptyState: {
      title: 'No calendar entries',
      description: 'Add entries with dates to see them in your calendar view.',
      actionText: 'Create entry',
    },
  },
  [DATABASE_VIEW_TYPES.GALLERY]: {
    id: DATABASE_VIEW_TYPES.GALLERY,
    name: 'Gallery',
    icon: Grid3X3,
    description: 'Browse entries in a visual card layout',
    emptyState: {
      title: 'No entries to display',
      description: 'Create entries to see them in a beautiful gallery view.',
      actionText: 'Create entry',
    },
  },
};

export const DATABASE_VIEW_ORDER: DatabaseViewType[] = [
  DATABASE_VIEW_TYPES.TABLE,
  DATABASE_VIEW_TYPES.BOARD,
  DATABASE_VIEW_TYPES.CALENDAR,
  DATABASE_VIEW_TYPES.GALLERY,
];
