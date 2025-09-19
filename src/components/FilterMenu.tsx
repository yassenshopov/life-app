import React, { useState } from 'react';
import {
  Filter,
  FilterGroup,
  FilterState,
  getAvailableOperators,
  filterNeedsValue,
} from '@/types/filters';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Filter as FilterIcon,
  Plus,
  X,
  Calendar as CalendarIcon,
  Trash2,
  PlusCircle,
  Circle,
} from 'lucide-react';
import { format } from 'date-fns';

interface FilterMenuProps {
  properties: Record<string, any>;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function FilterMenu({
  properties,
  filters,
  onFiltersChange,
  onClearFilters,
}: FilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const addFilter = (groupId: string) => {
    const newFilter: Filter = {
      id: `filter-${Date.now()}`,
      property: Object.keys(properties)[0] || '',
      propertyType: properties[Object.keys(properties)[0]]?.type || 'title',
      operator: 'equals',
      value: '',
    };

    const updatedGroups = filters.groups.map((group) =>
      group.id === groupId ? { ...group, filters: [...group.filters, newFilter] } : group
    );

    onFiltersChange({ groups: updatedGroups });
  };

  const removeFilter = (groupId: string, filterId: string) => {
    const updatedGroups = filters.groups
      .map((group) =>
        group.id === groupId
          ? { ...group, filters: group.filters.filter((f) => f.id !== filterId) }
          : group
      )
      .filter((group) => group.filters.length > 0);

    onFiltersChange({ groups: updatedGroups });
  };

  const updateFilter = (groupId: string, filterId: string, updates: Partial<Filter>) => {
    const updatedGroups = filters.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            filters: group.filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
          }
        : group
    );

    onFiltersChange({ groups: updatedGroups });
  };

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      filters: [],
      operator: 'and',
    };

    onFiltersChange({ groups: [...filters.groups, newGroup] });
  };

  const removeFilterGroup = (groupId: string) => {
    onFiltersChange({
      groups: filters.groups.filter((g) => g.id !== groupId),
    });
  };

  const updateGroupOperator = (groupId: string, operator: 'and' | 'or') => {
    const updatedGroups = filters.groups.map((group) =>
      group.id === groupId ? { ...group, operator } : group
    );

    onFiltersChange({ groups: updatedGroups });
  };

  const getPropertyOptions = () => {
    return Object.entries(properties).map(([key, prop]) => ({
      value: key,
      label: prop.name,
      type: prop.type,
    }));
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      equals: 'equals',
      not_equals: 'does not equal',
      contains: 'contains',
      does_not_contain: 'does not contain',
      is_empty: 'is empty',
      is_not_empty: 'is not empty',
      starts_with: 'starts with',
      ends_with: 'ends with',
      greater_than: 'is greater than',
      less_than: 'is less than',
      greater_than_or_equal_to: 'is greater than or equal to',
      less_than_or_equal_to: 'is less than or equal to',
      before: 'is before',
      after: 'is after',
      on_or_before: 'is on or before',
      on_or_after: 'is on or after',
      past_week: 'in the past week',
      past_month: 'in the past month',
      past_year: 'in the past year',
      next_week: 'in the next week',
      next_month: 'in the next month',
      next_year: 'in the next year',
    };
    return labels[operator] || operator;
  };

  const renderFilterValue = (filter: Filter) => {
    const { propertyType, operator, value } = filter;

    if (!filterNeedsValue(operator)) {
      return null;
    }

    switch (propertyType) {
      case NOTION_PROPERTY_TYPES.TITLE:
      case NOTION_PROPERTY_TYPES.RICH_TEXT:
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                { value: e.target.value }
              )
            }
            placeholder="Enter text..."
            className="w-48"
          />
        );

      case NOTION_PROPERTY_TYPES.NUMBER:
        return (
          <Input
            type="number"
            value={(value as number) || ''}
            onChange={(e) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                { value: parseFloat(e.target.value) || 0 }
              )
            }
            placeholder="Enter number..."
            className="w-32"
          />
        );

      case NOTION_PROPERTY_TYPES.SELECT:
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                { value: e.target.value }
              )
            }
            placeholder="Enter option..."
            className="w-48"
          />
        );

      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return (
          <Input
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                {
                  value: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              )
            }
            placeholder="Enter options (comma-separated)..."
            className="w-48"
          />
        );

      case NOTION_PROPERTY_TYPES.DATE:
      case NOTION_PROPERTY_TYPES.CREATED_TIME:
      case NOTION_PROPERTY_TYPES.LAST_EDITED_TIME:
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value as string), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) =>
                  updateFilter(
                    filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                    filter.id,
                    { value: date ? date.toISOString() : '' }
                  )
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case NOTION_PROPERTY_TYPES.CHECKBOX:
        return (
          <Checkbox
            checked={(value as boolean) || false}
            onCheckedChange={(checked) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                { value: checked as boolean }
              )
            }
          />
        );

      default:
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) =>
              updateFilter(
                filters.groups.find((g) => g.filters.some((f) => f.id === filter.id))?.id || '',
                filter.id,
                { value: e.target.value }
              )
            }
            placeholder="Enter value..."
            className="w-48"
          />
        );
    }
  };

  const totalFilters = filters.groups.reduce((sum, group) => sum + group.filters.length, 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FilterIcon className="w-4 h-4" />
          Filters
          {totalFilters > 0 && (
            <Badge variant="secondary" className="ml-1">
              {totalFilters}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Filters</h3>
            <div className="flex gap-2">
              {totalFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  Clear all
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {filters.groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FilterIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No filters applied</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={addFilterGroup}>
                <Plus className="w-4 h-4 mr-2" />
                Add filter
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filters.groups.map((group, groupIndex) => (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Filter Group {groupIndex + 1}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Select
                          value={group.operator}
                          onValueChange={(value: 'and' | 'or') =>
                            updateGroupOperator(group.id, value)
                          }
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="and">
                              <div className="flex items-center gap-2">
                                <PlusCircle className="w-3 h-3" />
                                AND
                              </div>
                            </SelectItem>
                            <SelectItem value="or">
                              <div className="flex items-center gap-2">
                                <Circle className="w-3 h-3" />
                                OR
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFilterGroup(group.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.filters.map((filter, filterIndex) => (
                      <div key={filter.id} className="space-y-2">
                        {filterIndex > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex-1 h-px bg-border" />
                            <span className="px-2">{group.operator.toUpperCase()}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Select
                            value={filter.property}
                            onValueChange={(value) => {
                              const property = properties[value];
                              updateFilter(group.id, filter.id, {
                                property: value,
                                propertyType: property.type,
                                operator: 'equals',
                                value: '',
                              });
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getPropertyOptions().map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filter.operator}
                            onValueChange={(value) =>
                              updateFilter(group.id, filter.id, { operator: value as any })
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableOperators(filter.propertyType).map((operator) => (
                                <SelectItem key={operator} value={operator}>
                                  {getOperatorLabel(operator)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {renderFilterValue(filter)}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFilter(group.id, filter.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFilter(group.id)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add condition
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" size="sm" onClick={addFilterGroup} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add filter group
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
