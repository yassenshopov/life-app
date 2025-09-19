// Notion property types and related constants
export const NOTION_PROPERTY_TYPES = {
  TITLE: 'title',
  RICH_TEXT: 'rich_text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  PEOPLE: 'people',
  FILES: 'files',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone_number',
  FORMULA: 'formula',
  RELATION: 'relation',
  ROLLUP: 'rollup',
  CREATED_TIME: 'created_time',
  CREATED_BY: 'created_by',
  LAST_EDITED_TIME: 'last_edited_time',
  LAST_EDITED_BY: 'last_edited_by',
  STATUS: 'status',
} as const;

export type NotionPropertyType = (typeof NOTION_PROPERTY_TYPES)[keyof typeof NOTION_PROPERTY_TYPES];

// Property type display names
export const PROPERTY_TYPE_DISPLAY_NAMES: Record<NotionPropertyType, string> = {
  [NOTION_PROPERTY_TYPES.TITLE]: 'Title',
  [NOTION_PROPERTY_TYPES.RICH_TEXT]: 'Text',
  [NOTION_PROPERTY_TYPES.NUMBER]: 'Number',
  [NOTION_PROPERTY_TYPES.SELECT]: 'Select',
  [NOTION_PROPERTY_TYPES.MULTI_SELECT]: 'Multi-select',
  [NOTION_PROPERTY_TYPES.DATE]: 'Date',
  [NOTION_PROPERTY_TYPES.PEOPLE]: 'People',
  [NOTION_PROPERTY_TYPES.FILES]: 'Files',
  [NOTION_PROPERTY_TYPES.CHECKBOX]: 'Checkbox',
  [NOTION_PROPERTY_TYPES.URL]: 'URL',
  [NOTION_PROPERTY_TYPES.EMAIL]: 'Email',
  [NOTION_PROPERTY_TYPES.PHONE]: 'Phone',
  [NOTION_PROPERTY_TYPES.FORMULA]: 'Formula',
  [NOTION_PROPERTY_TYPES.RELATION]: 'Relation',
  [NOTION_PROPERTY_TYPES.ROLLUP]: 'Rollup',
  [NOTION_PROPERTY_TYPES.CREATED_TIME]: 'Created time',
  [NOTION_PROPERTY_TYPES.CREATED_BY]: 'Created by',
  [NOTION_PROPERTY_TYPES.LAST_EDITED_TIME]: 'Last edited time',
  [NOTION_PROPERTY_TYPES.LAST_EDITED_BY]: 'Last edited by',
  [NOTION_PROPERTY_TYPES.STATUS]: 'Status',
};

// Common database property configurations
export const COMMON_DATABASE_PROPERTIES = {
  TITLE: {
    type: NOTION_PROPERTY_TYPES.TITLE,
    required: true,
    description: 'The main title of the entry',
  },
  DATE: {
    type: NOTION_PROPERTY_TYPES.DATE,
    required: true,
    description: 'The date of the entry',
  },
  STATUS: {
    type: NOTION_PROPERTY_TYPES.STATUS,
    description: 'Current status of the entry',
  },
  PRIORITY: {
    type: NOTION_PROPERTY_TYPES.SELECT,
    description: 'Priority level of the entry',
  },
  NOTES: {
    type: NOTION_PROPERTY_TYPES.RICH_TEXT,
    description: 'Additional notes or comments',
  },
  ASSIGNEE: {
    type: NOTION_PROPERTY_TYPES.PEOPLE,
    description: 'Person assigned to this entry',
  },
  TAGS: {
    type: NOTION_PROPERTY_TYPES.MULTI_SELECT,
    description: 'Tags to categorize the entry',
  },
} as const;

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 10,
} as const;

// Re-export database view types from canonical source
export { DATABASE_VIEW_TYPES, type DatabaseViewType } from './database-views';
