import { NOTION_PROPERTY_TYPES, NotionPropertyType } from '@/constants/notion-properties';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'does_not_contain'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal_to'
  | 'less_than_or_equal_to'
  | 'before'
  | 'after'
  | 'on_or_before'
  | 'on_or_after'
  | 'past_week'
  | 'past_month'
  | 'past_year'
  | 'next_week'
  | 'next_month'
  | 'next_year';

export interface BaseFilter {
  id: string;
  property: string;
  propertyType: NotionPropertyType;
  operator: FilterOperator;
}

export interface TextFilter extends BaseFilter {
  propertyType: 'title' | 'rich_text';
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'does_not_contain'
    | 'is_empty'
    | 'is_not_empty'
    | 'starts_with'
    | 'ends_with';
  value: string;
}

export interface NumberFilter extends BaseFilter {
  propertyType: 'number';
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'greater_than_or_equal_to'
    | 'less_than_or_equal_to'
    | 'is_empty'
    | 'is_not_empty';
  value: number;
}

export interface SelectFilter extends BaseFilter {
  propertyType: 'select';
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';
  value: string | undefined;
}

export interface MultiSelectFilter extends BaseFilter {
  propertyType: 'multi_select';
  operator: 'contains' | 'does_not_contain' | 'is_empty' | 'is_not_empty';
  value: string[] | undefined;
}

export interface DateFilter extends BaseFilter {
  propertyType: 'date' | 'created_time' | 'last_edited_time';
  operator:
    | 'equals'
    | 'not_equals'
    | 'before'
    | 'after'
    | 'on_or_before'
    | 'on_or_after'
    | 'is_empty'
    | 'is_not_empty'
    | 'past_week'
    | 'past_month'
    | 'past_year'
    | 'next_week'
    | 'next_month'
    | 'next_year';
  value?: string; // ISO date string (optional for operators that don't need values)
}

export interface CheckboxFilter extends BaseFilter {
  propertyType: 'checkbox';
  operator: 'equals' | 'not_equals';
  value: boolean;
}

export type Filter =
  | TextFilter
  | NumberFilter
  | SelectFilter
  | MultiSelectFilter
  | DateFilter
  | CheckboxFilter;

export interface FilterGroup {
  id: string;
  filters: Filter[];
  operator: 'and' | 'or';
}

export interface FilterState {
  groups: FilterGroup[];
}

// Helper function to get available operators for a property type
export function getAvailableOperators(propertyType: NotionPropertyType): FilterOperator[] {
  switch (propertyType) {
    case NOTION_PROPERTY_TYPES.TITLE:
    case NOTION_PROPERTY_TYPES.RICH_TEXT:
      return [
        'equals',
        'not_equals',
        'contains',
        'does_not_contain',
        'is_empty',
        'is_not_empty',
        'starts_with',
        'ends_with',
      ];

    case NOTION_PROPERTY_TYPES.NUMBER:
      return [
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_than_or_equal_to',
        'less_than_or_equal_to',
        'is_empty',
        'is_not_empty',
      ];

    case NOTION_PROPERTY_TYPES.SELECT:
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];

    case NOTION_PROPERTY_TYPES.MULTI_SELECT:
      return ['contains', 'does_not_contain', 'is_empty', 'is_not_empty'];

    case NOTION_PROPERTY_TYPES.DATE:
    case NOTION_PROPERTY_TYPES.CREATED_TIME:
    case NOTION_PROPERTY_TYPES.LAST_EDITED_TIME:
      return [
        'equals',
        'not_equals',
        'before',
        'after',
        'on_or_before',
        'on_or_after',
        'is_empty',
        'is_not_empty',
        'past_week',
        'past_month',
        'past_year',
        'next_week',
        'next_month',
        'next_year',
      ];

    case NOTION_PROPERTY_TYPES.CHECKBOX:
      return ['equals', 'not_equals'];

    default:
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
  }
}

// Helper function to check if a filter needs a value input
export function filterNeedsValue(operator: FilterOperator): boolean {
  const noValueOperators: FilterOperator[] = [
    'is_empty',
    'is_not_empty',
    'past_week',
    'past_month',
    'past_year',
    'next_week',
    'next_month',
    'next_year',
  ];
  return !noValueOperators.includes(operator);
}
