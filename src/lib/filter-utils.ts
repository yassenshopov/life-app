import { Filter, FilterGroup, FilterState } from '@/types/filters';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';

// Helper function to get property value from a page
function getPropertyValue(page: any, propertyKey: string, propertyType: string): any {
  const property = page.properties?.[propertyKey];
  if (!property) return null;

  switch (propertyType) {
    case NOTION_PROPERTY_TYPES.TITLE:
      return property.title?.[0]?.plain_text || '';

    case NOTION_PROPERTY_TYPES.RICH_TEXT:
      return property.rich_text?.[0]?.plain_text || '';

    case NOTION_PROPERTY_TYPES.NUMBER:
      return property.number;

    case NOTION_PROPERTY_TYPES.SELECT:
      return property.select?.name || '';

    case NOTION_PROPERTY_TYPES.MULTI_SELECT:
      return property.multi_select?.map((item: any) => item.name) || [];

    case NOTION_PROPERTY_TYPES.DATE:
      return property.date?.start || '';

    case NOTION_PROPERTY_TYPES.CHECKBOX:
      return property.checkbox || false;

    case NOTION_PROPERTY_TYPES.CREATED_TIME:
      return page.created_time || '';

    case NOTION_PROPERTY_TYPES.LAST_EDITED_TIME:
      return page.last_edited_time || '';

    default:
      return null;
  }
}

// Helper function to check if a single filter matches a page
function matchesFilter(page: any, filter: Filter): boolean {
  const pageValue = getPropertyValue(page, filter.property, filter.propertyType);
  const filterValue = filter.value;

  switch (filter.operator) {
    case 'equals':
      if (filter.propertyType === NOTION_PROPERTY_TYPES.MULTI_SELECT) {
        return Array.isArray(pageValue) && pageValue.includes(filterValue);
      }
      return pageValue === filterValue;

    case 'not_equals':
      if (filter.propertyType === NOTION_PROPERTY_TYPES.MULTI_SELECT) {
        return !Array.isArray(pageValue) || !pageValue.includes(filterValue);
      }
      return pageValue !== filterValue;

    case 'contains':
      if (typeof pageValue === 'string' && typeof filterValue === 'string') {
        return pageValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      if (Array.isArray(pageValue) && Array.isArray(filterValue)) {
        return filterValue.some((val) => pageValue.includes(val));
      }
      return false;

    case 'does_not_contain':
      if (typeof pageValue === 'string' && typeof filterValue === 'string') {
        return !pageValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      if (Array.isArray(pageValue) && Array.isArray(filterValue)) {
        return !filterValue.some((val) => pageValue.includes(val));
      }
      return true;

    case 'is_empty':
      if (Array.isArray(pageValue)) {
        return pageValue.length === 0;
      }
      return !pageValue || pageValue === '';

    case 'is_not_empty':
      if (Array.isArray(pageValue)) {
        return pageValue.length > 0;
      }
      return pageValue && pageValue !== '';

    case 'starts_with':
      return (
        typeof pageValue === 'string' &&
        typeof filterValue === 'string' &&
        pageValue.toLowerCase().startsWith(filterValue.toLowerCase())
      );

    case 'ends_with':
      return (
        typeof pageValue === 'string' &&
        typeof filterValue === 'string' &&
        pageValue.toLowerCase().endsWith(filterValue.toLowerCase())
      );

    case 'greater_than':
      return (
        typeof pageValue === 'number' && typeof filterValue === 'number' && pageValue > filterValue
      );

    case 'less_than':
      return (
        typeof pageValue === 'number' && typeof filterValue === 'number' && pageValue < filterValue
      );

    case 'greater_than_or_equal_to':
      return (
        typeof pageValue === 'number' && typeof filterValue === 'number' && pageValue >= filterValue
      );

    case 'less_than_or_equal_to':
      return (
        typeof pageValue === 'number' && typeof filterValue === 'number' && pageValue <= filterValue
      );

    case 'before':
      return new Date(pageValue) < new Date(filterValue);

    case 'after':
      return new Date(pageValue) > new Date(filterValue);

    case 'on_or_before':
      return new Date(pageValue) <= new Date(filterValue);

    case 'on_or_after':
      return new Date(pageValue) >= new Date(filterValue);

    case 'past_week':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(pageValue) >= weekAgo;

    case 'past_month':
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(pageValue) >= monthAgo;

    case 'past_year':
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return new Date(pageValue) >= yearAgo;

    case 'next_week':
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return new Date(pageValue) <= nextWeek;

    case 'next_month':
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return new Date(pageValue) <= nextMonth;

    case 'next_year':
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      return new Date(pageValue) <= nextYear;

    default:
      return false;
  }
}

// Helper function to check if a filter group matches a page
function matchesFilterGroup(page: any, group: FilterGroup): boolean {
  if (group.filters.length === 0) return true;

  if (group.operator === 'and') {
    return group.filters.every((filter) => matchesFilter(page, filter));
  } else {
    return group.filters.some((filter) => matchesFilter(page, filter));
  }
}

// Main function to filter pages based on filter state
export function filterPages(pages: any[], filters: FilterState): any[] {
  if (!filters.groups.length) return pages;

  return pages.filter((page) => filters.groups.some((group) => matchesFilterGroup(page, group)));
}

// Helper function to get active filter count
export function getActiveFilterCount(filters: FilterState): number {
  return filters.groups.reduce((sum, group) => sum + group.filters.length, 0);
}

// Helper function to check if filters are active
export function hasActiveFilters(filters: FilterState): boolean {
  return getActiveFilterCount(filters) > 0;
}
