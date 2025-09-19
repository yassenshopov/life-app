'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NewEntryDialog } from '@/components/dialogs/NewEntryDialog';
import { EntryPeekModal } from '@/components/EntryPeekModal';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { useDatabasePages } from '@/hooks/useDatabase';
import { FilterState } from '@/types/filters';
import { filterPages } from '@/lib/filter-utils';
import { NotionBadge, NotionBadgeList } from '@/components/NotionBadge';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Type,
  Star,
  Sparkles,
  Calendar,
  Tag,
  Folder,
  Search,
  Target,
  Database,
} from 'lucide-react';
import {
  NOTION_PROPERTY_TYPES,
  PROPERTY_TYPE_DISPLAY_NAMES,
  PAGINATION,
} from '@/constants/notion-properties';

interface NotionProperty {
  type: string;
  name: string;
}

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
  created_time: string;
  last_edited_time: string;
}

interface DatabaseTableProps {
  databaseId: string;
  properties: { [key: string]: NotionProperty };
  pageSize?: number;
  emptyState?: React.ReactNode;
  visibleProperties?: string[];
  filters?: FilterState;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function DatabaseTable({
  databaseId,
  properties,
  pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
  emptyState,
  visibleProperties,
  filters,
}: DatabaseTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isPeekOpen, setIsPeekOpen] = useState(false);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder="Search entries..."]'
        ) as HTMLInputElement;
        searchInput?.focus();
      }
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDatabasePages(databaseId, pageSize);

  const { deleteEntry, isLoading: isDeleting } = useDeleteEntry({
    onSuccess: () => {
      // Entry deleted successfully
    },
    onError: (error) => {
      console.error('Failed to delete entry:', error);
      // You could add a toast notification here
    },
  });

  // Flatten all pages into a single array
  const pages = data?.pages.flatMap((page) => page.pages) ?? [];

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

  const handleEntryClick = (entry: any) => {
    setSelectedEntry(entry);
    setIsPeekOpen(true);
  };

  const handlePeekClose = () => {
    setIsPeekOpen(false);
    setSelectedEntry(null);
  };

  const handleEntryUpdate = (entryId: string, updates: Record<string, any>) => {
    // TODO: Implement entry update functionality
    console.log('Update entry:', entryId, updates);
  };

  const handleEntryDelete = (entryId: string) => {
    deleteEntry(entryId, databaseId);
  };

  const getEntryTitle = (entry: any) => {
    const titleProperty = Object.entries(properties).find(
      ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.TITLE
    );
    if (titleProperty) {
      const [titleKey] = titleProperty;
      const titleValue = entry.properties[titleKey];
      return titleValue?.title?.[0]?.plain_text || 'Untitled';
    }
    return 'Untitled';
  };

  // Filter and sort pages based on search query, filters, and sort configuration
  const filteredAndSortedPages = React.useMemo(() => {
    let filteredPages = pages;

    // Apply custom filters first
    if (filters && filters.groups.length > 0) {
      filteredPages = filterPages(pages, filters);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filteredPages = filteredPages.filter((page) => {
        return Object.entries(page.properties).some(([key, value]) => {
          const property = properties[key];
          if (!property || !value) return false;

          let searchableText = '';
          switch (property.type) {
            case NOTION_PROPERTY_TYPES.TITLE:
              searchableText = value.title?.[0]?.plain_text || '';
              break;
            case NOTION_PROPERTY_TYPES.RICH_TEXT:
              searchableText = value.rich_text?.[0]?.plain_text || '';
              break;
            case NOTION_PROPERTY_TYPES.SELECT:
              searchableText = value.select?.name || '';
              break;
            case NOTION_PROPERTY_TYPES.STATUS:
              searchableText = value.status?.name || '';
              break;
            case NOTION_PROPERTY_TYPES.MULTI_SELECT:
              searchableText = value.multi_select?.map((item: any) => item.name).join(' ') || '';
              break;
            default:
              searchableText = String(value);
          }
          return searchableText.toLowerCase().includes(searchQuery.toLowerCase());
        });
      });
    }

    // Apply sorting
    if (!sortConfig.key || !sortConfig.direction) {
      return filteredPages;
    }

    return [...filteredPages].sort((a, b) => {
      const aValue = a.properties[sortConfig.key];
      const bValue = b.properties[sortConfig.key];

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      // Extract comparable values based on property type
      let aComparable: any;
      let bComparable: any;

      const property = properties[sortConfig.key];
      if (!property) return 0;

      switch (property.type) {
        case NOTION_PROPERTY_TYPES.TITLE:
          aComparable = aValue.title?.[0]?.plain_text || '';
          bComparable = bValue.title?.[0]?.plain_text || '';
          break;
        case NOTION_PROPERTY_TYPES.RICH_TEXT:
          aComparable = aValue.rich_text?.[0]?.plain_text || '';
          bComparable = bValue.rich_text?.[0]?.plain_text || '';
          break;
        case NOTION_PROPERTY_TYPES.NUMBER:
          aComparable = aValue.number || 0;
          bComparable = bValue.number || 0;
          break;
        case NOTION_PROPERTY_TYPES.DATE:
          aComparable = aValue.date?.start ? new Date(aValue.date.start).getTime() : 0;
          bComparable = bValue.date?.start ? new Date(bValue.date.start).getTime() : 0;
          break;
        case NOTION_PROPERTY_TYPES.SELECT:
          aComparable = aValue.select?.name || '';
          bComparable = bValue.select?.name || '';
          break;
        case NOTION_PROPERTY_TYPES.STATUS:
          aComparable = aValue.status?.name || '';
          bComparable = bValue.status?.name || '';
          break;
        default:
          aComparable = String(aValue);
          bComparable = String(bValue);
      }

      if (aComparable < bComparable) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aComparable > bComparable) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [pages, sortConfig, properties, searchQuery, filters]);

  const getPropertyIcon = (propertyType: string) => {
    switch (propertyType) {
      case NOTION_PROPERTY_TYPES.TITLE:
        return <Type className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.SELECT:
      case NOTION_PROPERTY_TYPES.STATUS:
        return <Star className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.DATE:
        return <Calendar className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return <Tag className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.PEOPLE:
        return <Search className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.RELATION:
        return <Folder className="w-3 h-3" />;
      case NOTION_PROPERTY_TYPES.FORMULA:
        return <Target className="w-3 h-3" />;
      default:
        return <Type className="w-3 h-3" />;
    }
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-4 h-4" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown className="w-4 h-4" />;
    }
    return <ArrowUpDown className="w-4 h-4 opacity-50" />;
  };

  const renderPropertyValue = (property: NotionProperty, value: any) => {
    if (!value) return <span className="text-muted-foreground">—</span>;

    switch (property.type) {
      case NOTION_PROPERTY_TYPES.TITLE:
        return (
          <span className="font-medium text-foreground">
            {value.title?.[0]?.plain_text || 'Untitled'}
          </span>
        );

      case NOTION_PROPERTY_TYPES.RICH_TEXT:
        return <span className="text-foreground">{value.rich_text?.[0]?.plain_text || '—'}</span>;

      case NOTION_PROPERTY_TYPES.NUMBER:
        return <span className="text-foreground">{value.number || '—'}</span>;

      case NOTION_PROPERTY_TYPES.SELECT:
        return value.select ? (
          <NotionBadge option={value.select} maxWidth="120px" />
        ) : (
          <span className="text-muted-foreground">—</span>
        );

      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return value.multi_select?.length > 0 ? (
          <NotionBadgeList
            options={value.multi_select}
            containerMaxWidth="200px"
            maxWidth="100px"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        );

      case NOTION_PROPERTY_TYPES.DATE:
        return value.date ? (
          <span className="text-foreground">
            {new Date(value.date.start).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );

      case NOTION_PROPERTY_TYPES.CHECKBOX:
        return (
          <span
            className={`text-lg ${
              value.checkbox ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            }`}
          >
            {value.checkbox ? '✓' : '✗'}
          </span>
        );

      case NOTION_PROPERTY_TYPES.STATUS:
        return value.status ? (
          <Badge
            variant={
              value.status.name === 'Done'
                ? 'default'
                : value.status.name === 'In Progress'
                ? 'secondary'
                : 'outline'
            }
            className="text-xs"
          >
            {value.status.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );

      case NOTION_PROPERTY_TYPES.PEOPLE:
        return value.people?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.people.map((person: any, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {person.name || person.id}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );

      default:
        return <span className="text-muted-foreground">—</span>;
    }
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (isLoading && pages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingSpinner size="lg" label="Loading database content..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load database content'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const propertyEntries = Object.entries(properties)
    .filter(([key]) => !visibleProperties || visibleProperties.includes(key))
    .sort(([keyA, propA], [keyB, propB]) => {
      // Always put title property first
      if (propA.type === NOTION_PROPERTY_TYPES.TITLE) return -1;
      if (propB.type === NOTION_PROPERTY_TYPES.TITLE) return 1;

      // Then sort alphabetically by property name
      return propA.name.localeCompare(propB.name);
    });

  return (
    <div className="bg-background">
      {/* Notion-style table header */}
      <div className="px-6 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-foreground">
              {filteredAndSortedPages.length}{' '}
              {filteredAndSortedPages.length === 1 ? 'entry' : 'entries'}
              {searchQuery && ` (filtered from ${pages.length})`}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 pr-8 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ⌘K
              </div>
            </div>
            <Button onClick={() => setIsNewEntryOpen(true)}>New Entry</Button>
          </div>
        </div>
      </div>

      {/* Notion-style table using shadcn Table */}
      <Table>
        <TableHeader>
          <TableRow>
            {propertyEntries.map(([key, property]) => (
              <TableHead
                key={key}
                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => handleSort(key)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {getPropertyIcon(property.type)}
                    <span className="select-none">{property.name}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {getSortIcon(key)}
                  </div>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedPages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={propertyEntries.length} className="text-center py-8">
                {emptyState && !searchQuery ? (
                  emptyState
                ) : (
                  <div className="flex flex-col items-center space-y-2">
                    <Database className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No entries match your search' : 'No entries found'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-sm text-primary hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedPages.map((page, index) => (
              <TableRow
                key={page.id}
                className={`${
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                } cursor-pointer hover:bg-muted/50 transition-colors`}
                onClick={() => handleEntryClick(page)}
              >
                {propertyEntries.map(([key, property]) => (
                  <TableCell key={key} className="text-sm">
                    {renderPropertyValue(property, page.properties[key])}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center py-4 border-t border-border">
          <Button
            onClick={loadMore}
            disabled={isFetchingNextPage}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <LoadingSpinner size="sm" />
                Loading more...
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                Load More
              </>
            )}
          </Button>
        </div>
      )}

      {/* Entry Peek Modal */}
      <EntryPeekModal
        isOpen={isPeekOpen}
        onClose={handlePeekClose}
        entry={selectedEntry}
        properties={properties}
        onUpdate={handleEntryUpdate}
        onDelete={handleEntryDelete}
      />

      <NewEntryDialog
        isOpen={isNewEntryOpen}
        onClose={() => setIsNewEntryOpen(false)}
        databaseId={databaseId}
      />
    </div>
  );
}
