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
import { Plus, User, Calendar, Tag } from 'lucide-react';

interface DatabaseBoardViewProps {
  databaseId: string;
  properties: Record<string, any>;
  pageSize?: number;
  emptyState?: React.ReactNode;
  filters?: FilterState;
}

export function DatabaseBoardView({
  databaseId,
  properties,
  pageSize = 50,
  emptyState,
  filters,
}: DatabaseBoardViewProps) {
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

  // Group pages by status
  const groupedPages = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      'To-Do': [],
      'In progress': [],
      Done: [],
    };

    filteredPages.forEach((page) => {
      // Find status property
      const statusProperty = Object.entries(properties).find(
        ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.STATUS
      );

      if (statusProperty) {
        const [statusKey, _] = statusProperty;
        const statusValue = page.properties[statusKey]?.status?.name || 'To-Do';
        const groupKey = statusValue || 'To-Do';

        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(page);
      } else {
        groups['To-Do'].push(page);
      }
    });

    return groups;
  }, [pages, properties]);

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
      default:
        return String(value);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
        <div className="text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error loading board: {error.message}</div>
      </div>
    );
  }

  // Check if all groups are empty
  const totalPages = Object.values(groupedPages).flat().length;
  if (totalPages === 0 && emptyState) {
    return <div className="flex-1 overflow-hidden">{emptyState}</div>;
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex h-full gap-4 p-4">
        {Object.entries(groupedPages).map(([status, statusPages]) => (
          <div key={status} className="flex-1 min-w-0">
            <div className="bg-muted/50 rounded-lg p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
                  <span className="font-medium text-foreground">{status}</span>
                  <span className="text-sm text-muted-foreground">({statusPages.length})</span>
                </div>
                <NewEntryDialog
                  databaseId={databaseId}
                  properties={properties}
                  trigger={
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>

              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {statusPages.map((page) => {
                  // Get title property
                  const titleProperty = Object.entries(properties).find(
                    ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.TITLE
                  );
                  const title = titleProperty
                    ? getPropertyValue(page, titleProperty[0], titleProperty[1])
                    : 'Untitled';

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
                      className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleEntryClick(page)}
                    >
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm leading-tight">{title}</h4>

                        {assignees && assignees.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>
                              {assignees.map((person: any) => person.name || person).join(', ')}
                            </span>
                          </div>
                        )}

                        {date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(date)}</span>
                          </div>
                        )}

                        {tagProperties.length > 0 && (
                          <div>
                            {tagProperties.map(([tagKey, tagProp]) => {
                              const tags = getPropertyValue(page, tagKey, tagProp);
                              return tags?.length > 0 ? (
                                <NotionBadgeList
                                  key={tagKey}
                                  options={tags}
                                  containerMaxWidth="200px"
                                  maxWidth="100px"
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

                {statusPages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tasks in {status.toLowerCase()}
                  </div>
                )}
              </div>

              <NewEntryDialog
                databaseId={databaseId}
                properties={properties}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New task
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </div>

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
  );
}
