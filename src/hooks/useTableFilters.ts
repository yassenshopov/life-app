import { useState, useMemo } from 'react';
import { FilterState, Filter } from '@/types/filters';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface UseTableFiltersOptions<T> {
  data: T[];
  searchFields?: (keyof T)[];
  filters?: FilterState;
  getSearchableText?: (item: T) => string;
  getSortValue?: (item: T, key: string) => any;
  getFilterValue?: (item: T, key: string) => any;
}

// Simple filter matching for flat objects
function matchesFilter<T extends Record<string, any>>(item: T, filter: Filter): boolean {
  const itemValue = item[filter.property];
  const filterValue = filter.value;

  if (itemValue === null || itemValue === undefined) {
    return filter.operator === 'is_empty';
  }

  switch (filter.operator) {
    case 'equals':
      return String(itemValue) === String(filterValue);
    case 'not_equals':
      return String(itemValue) !== String(filterValue);
    case 'contains':
      return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'does_not_contain':
      return !String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'is_empty':
      return !itemValue || String(itemValue).trim() === '';
    case 'is_not_empty':
      return !!itemValue && String(itemValue).trim() !== '';
    case 'starts_with':
      return String(itemValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case 'ends_with':
      return String(itemValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case 'greater_than':
      return Number(itemValue) > Number(filterValue);
    case 'less_than':
      return Number(itemValue) < Number(filterValue);
    case 'greater_than_or_equal_to':
      return Number(itemValue) >= Number(filterValue);
    case 'less_than_or_equal_to':
      return Number(itemValue) <= Number(filterValue);
    default:
      return true;
  }
}

function applyFilters<T extends Record<string, any>>(data: T[], filters: FilterState): T[] {
  if (!filters.groups.length) return data;

  return data.filter((item) => {
    return filters.groups.some((group) => {
      if (group.filters.length === 0) return true;
      if (group.operator === 'and') {
        return group.filters.every((filter) => matchesFilter(item, filter));
      } else {
        return group.filters.some((filter) => matchesFilter(item, filter));
      }
    });
  });
}

export function useTableFilters<T extends Record<string, any>>({
  data,
  searchFields,
  filters,
  getSearchableText,
  getSortValue,
}: UseTableFiltersOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key
          ? prev.direction === 'asc'
            ? 'desc'
            : prev.direction === 'desc'
            ? null
            : 'asc'
          : 'asc',
    }));
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply filters
    if (filters && filters.groups.length > 0) {
      filtered = applyFilters(filtered, filters);
    }

    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter((item) => {
        if (getSearchableText) {
          return getSearchableText(item).toLowerCase().includes(searchQuery.toLowerCase());
        }

        if (searchFields) {
          return searchFields.some((field) => {
            const value = item[field];
            return String(value || '').toLowerCase().includes(searchQuery.toLowerCase());
          });
        }

        // Default: search all string values
        return Object.values(item).some((value) =>
          String(value || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Apply sorting
    if (!sortConfig.key || !sortConfig.direction) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aValue = getSortValue ? getSortValue(a, sortConfig.key) : a[sortConfig.key];
      const bValue = getSortValue ? getSortValue(b, sortConfig.key) : b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle different value types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [data, filters, searchQuery, sortConfig, searchFields, getSearchableText, getSortValue]);

  return {
    searchQuery,
    setSearchQuery,
    sortConfig,
    handleSort,
    filteredAndSortedData,
  };
}

