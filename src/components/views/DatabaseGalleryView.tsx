'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDatabasePages } from '@/hooks/useDatabase';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';
import { NewEntryDialog } from '@/components/dialogs/NewEntryDialog';
import { EntryPeekModal } from '@/components/EntryPeekModal';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { FilterState } from '@/types/filters';
import { filterPages } from '@/lib/filter-utils';
import { NotionBadgeList } from '@/components/NotionBadge';
import { Plus, User, Calendar, Tag, FileText } from 'lucide-react';

interface DatabaseGalleryViewProps {
  databaseId: string;
  properties: Record<string, any>;
  pageSize?: number;
  emptyState?: React.ReactNode;
  filters?: FilterState;
}

export function DatabaseGalleryView({
  databaseId,
  properties,
  pageSize = 50,
  emptyState,
  filters,
}: DatabaseGalleryViewProps) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDatabasePages(databaseId, pageSize);

  const pages = data?.pages.flatMap((page) => page.pages) ?? [];

  // Apply filters to pages
  const filteredPages = React.useMemo(() => {
    if (filters && filters.groups.length > 0) {
      return filterPages(pages, filters);
    }
    return pages;
  }, [pages, filters]);

  const [selectedEntry, setSelectedEntry] = React.useState<any>(null);
  const [isPeekOpen, setIsPeekOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [entryToDelete, setEntryToDelete] = React.useState<any>(null);

  const { deleteEntry, isLoading: isDeleting } = useDeleteEntry({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete entry:', error);
    },
  });

  const getPropertyValue = (page: any, propertyKey: string, property: any) => {
    const value = page.properties[propertyKey];
    if (!value) return null;

    switch (property.type) {
      case NOTION_PROPERTY_TYPES.TITLE:
        return value.title?.[0]?.plain_text || '';
      case NOTION_PROPERTY_TYPES.RICH_TEXT:
        return value.rich_text?.[0]?.plain_text || '';
      case NOTION_PROPERTY_TYPES.SELECT:
        return value.select?.name || '';
      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return value.multi_select?.map((item: any) => item.name) || [];
      case NOTION_PROPERTY_TYPES.DATE:
        return value.date?.start || '';
      case NOTION_PROPERTY_TYPES.PEOPLE:
        return value.people || [];
      case NOTION_PROPERTY_TYPES.STATUS:
        return value.status?.name || '';
      default:
        return String(value);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'To-Do': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'In progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      Done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      Blocked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
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
    const entry = filteredPages.find((p) => p.id === entryId);
    if (entry) {
      setEntryToDelete(entry);
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    if (entryToDelete) {
      deleteEntry(entryToDelete.id, databaseId);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setEntryToDelete(null);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading gallery...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error loading gallery: {error.message}</div>
      </div>
    );
  }

  if (filteredPages.length === 0 && emptyState) {
    return <div className="flex-1 overflow-hidden">{emptyState}</div>;
  }

  if (filteredPages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No entries found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Gallery Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              {filteredPages.length} {filteredPages.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <NewEntryDialog
            databaseId={databaseId}
            properties={properties}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            }
          />
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPages.map((page) => {
              // Get title property
              const titleProperty = Object.entries(properties).find(
                ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.TITLE
              );
              const title = titleProperty
                ? getPropertyValue(page, titleProperty[0], titleProperty[1])
                : 'Untitled';

              // Get status property
              const statusProperty = Object.entries(properties).find(
                ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.STATUS
              );
              const status = statusProperty
                ? getPropertyValue(page, statusProperty[0], statusProperty[1])
                : '';

              // Get assignee property
              const assigneeProperty = Object.entries(properties).find(
                ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.PEOPLE
              );
              const assignees = assigneeProperty
                ? getPropertyValue(page, assigneeProperty[0], assigneeProperty[1])
                : [];

              // Get date property
              const dateProperty = Object.entries(properties).find(
                ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.DATE
              );
              const date = dateProperty
                ? getPropertyValue(page, dateProperty[0], dateProperty[1])
                : '';

              // Get tags/multi-select properties
              const tagProperties = Object.entries(properties).filter(
                ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.MULTI_SELECT
              );

              return (
                <Card
                  key={page.id}
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors group"
                  onClick={() => handleEntryClick(page)}
                >
                  <div className="space-y-3">
                    {/* Status Badge */}
                    {status && (
                      <div className="flex justify-start">
                        <Badge
                          variant="secondary"
                          className={`text-xs px-2 py-1 ${getStatusColor(status)}`}
                        >
                          {status}
                        </Badge>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {title}
                    </h3>

                    {/* Assignees */}
                    {assignees && assignees.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {assignees.map((person: any) => person.name || person).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Date */}
                    {date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>{formatDate(date)}</span>
                      </div>
                    )}

                    {/* Tags */}
                    {tagProperties.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {tagProperties.map(([tagKey, tagProp]) => {
                          const tags = getPropertyValue(page, tagKey, tagProp);
                          return tags?.length > 0 ? (
                            <NotionBadgeList
                              key={tagKey}
                              options={tags}
                              containerMaxWidth="200px"
                              maxWidth="100px"
                              limit={3}
                              className="px-1.5 py-0.5"
                            />
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
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

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            isOpen={deleteDialogOpen}
            onClose={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            title="Delete Entry"
            description="Are you sure you want to delete this entry? This action cannot be undone."
            itemName={entryToDelete ? getEntryTitle(entryToDelete) : undefined}
            isLoading={isDeleting}
          />
        </div>
      </div>
    </div>
  );
}
