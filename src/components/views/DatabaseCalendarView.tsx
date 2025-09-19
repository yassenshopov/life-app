'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { PageIcon } from '@/components/PageIcon';
import { useDatabasePages } from '@/hooks/useDatabase';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';
import { NewEntryDialog } from '@/components/dialogs/NewEntryDialog';
import { EntryPeekModal } from '@/components/EntryPeekModal';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { FilterState } from '@/types/filters';
import { filterPages } from '@/lib/filter-utils';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';

interface DatabaseCalendarViewProps {
  databaseId: string;
  properties: Record<string, any>;
  pageSize?: number;
  emptyState?: React.ReactNode;
  filters?: FilterState;
}

export function DatabaseCalendarView({
  databaseId,
  properties,
  pageSize = 50,
  emptyState,
  filters,
}: DatabaseCalendarViewProps) {
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
  const [isNewEntryOpen, setIsNewEntryOpen] = React.useState(false);

  const { deleteEntry, isLoading: isDeleting } = useDeleteEntry({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete entry:', error);
    },
  });

  const [currentDate, setCurrentDate] = React.useState(new Date());

  // Get date property
  const dateProperty = React.useMemo(() => {
    return Object.entries(properties).find(([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.DATE);
  }, [properties]);

  // Group pages by date
  const groupedPages = React.useMemo(() => {
    const groups: Record<string, any[]> = {};

    filteredPages.forEach((page) => {
      if (dateProperty) {
        const dateValue = page.properties[dateProperty[0]]?.date?.start;
        if (dateValue) {
          const dateKey = new Date(dateValue).toDateString();
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(page);
        }
      }
    });

    return groups;
  }, [filteredPages, dateProperty]);

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
      case NOTION_PROPERTY_TYPES.STATUS:
        return value.status?.name || '';
      default:
        return String(value);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getTasksForDate = (date: Date) => {
    const dateKey = date.toDateString();
    return groupedPages[dateKey] || [];
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
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error loading calendar: {error.message}</div>
      </div>
    );
  }

  // Check if there are no pages with dates
  const pagesWithDates = filteredPages.filter((page) => {
    const dateProperty = Object.entries(properties).find(
      ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.DATE
    );
    if (!dateProperty) return false;
    const [dateKey] = dateProperty;
    return page.properties[dateKey]?.date?.start;
  });

  console.log('Calendar view debug:', {
    filteredPages: filteredPages.length,
    pagesWithDates: pagesWithDates.length,
    dateProperty: dateProperty ? dateProperty[0] : null,
    properties: Object.keys(properties),
    samplePage: filteredPages[0] ? Object.keys(filteredPages[0].properties) : null,
  });

  // Check if we should show a disclaimer banner
  const showNoDatesBanner = pagesWithDates.length === 0 && filteredPages.length > 0;
  const hasDateProperty = !!dateProperty;

  // Only show empty state if there are truly no entries at all
  if (filteredPages.length === 0 && emptyState) {
    return <div className="flex-1 overflow-hidden">{emptyState}</div>;
  }

  // Remove the early return - let it fall through to show calendar grid with banner

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button onClick={() => setIsNewEntryOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>

        {/* Disclaimer Banner */}
        {showNoDatesBanner && (
          <div className="mx-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {hasDateProperty
                  ? 'No entries with dates found. Add dates to your entries to see them on the calendar.'
                  : 'No date property found in this database. Add a date property to use the calendar view.'}
              </p>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="bg-muted/50 p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="bg-background min-h-[120px]" />;
              }

              const tasks = getTasksForDate(date);
              const isCurrentDay = isToday(date);

              return (
                <div
                  key={date.toISOString()}
                  className={`bg-background min-h-[120px] p-3 border-r border-b ${
                    isCurrentDay ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-sm font-medium ${
                        isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {tasks.length > 0 && (
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                        {tasks.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {tasks.slice(0, 3).map((task) => {
                      // Get title property
                      const titleProperty = Object.entries(properties).find(
                        ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.TITLE
                      );
                      const title = titleProperty
                        ? getPropertyValue(task, titleProperty[0], titleProperty[1])
                        : 'Untitled';

                      // Get status property
                      const statusProperty = Object.entries(properties).find(
                        ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.STATUS
                      );
                      const status = statusProperty
                        ? getPropertyValue(task, statusProperty[0], statusProperty[1])
                        : '';

                      return (
                        <Card
                          key={task.id}
                          className="p-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleEntryClick(task)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <PageIcon icon={task.icon} className="w-3 h-3 flex-shrink-0" />
                              <p className="font-medium truncate">{title}</p>
                            </div>
                            {status && (
                              <Badge variant="outline" className="text-xs px-1 py-0.5">
                                {status}
                              </Badge>
                            )}
                          </div>
                        </Card>
                      );
                    })}

                    {tasks.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{tasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

      <NewEntryDialog
        isOpen={isNewEntryOpen}
        onClose={() => setIsNewEntryOpen(false)}
        databaseId={databaseId}
      />
    </div>
  );
}
