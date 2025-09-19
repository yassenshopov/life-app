'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useDatabase } from '@/hooks/useDatabase';
import {
  Database,
  Calendar,
  Target,
  BarChart3,
  Heart,
  MoreHorizontal,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DatabaseTable } from '@/components/DatabaseTable';
import { DatabaseBoardView } from '@/components/views/DatabaseBoardView';
import { DatabaseCalendarView } from '@/components/views/DatabaseCalendarView';
import { DatabaseGalleryView } from '@/components/views/DatabaseGalleryView';
import { NewEntryDialog } from '@/components/dialogs/NewEntryDialog';
import { EmptyState } from '@/components/EmptyState';
import { PropertyVisibilityMenu } from '@/components/PropertyVisibilityMenu';
import { FilterMenu } from '@/components/FilterMenu';
import { DatabaseSyncSettings } from '@/components/DatabaseSyncSettings';
import DashboardLayout from '@/components/DashboardLayout';
import { PROPERTY_TYPE_DISPLAY_NAMES } from '@/constants/notion-properties';
import { DATABASE_VIEW_CONFIGS, DATABASE_VIEW_ORDER } from '@/constants/database-views';
import { FilterState } from '@/types/filters';
import { filterPages, hasActiveFilters } from '@/lib/filter-utils';
import { cacheUtils } from '@/lib/cache-utils';
import { useQueryClient } from '@tanstack/react-query';

interface NotionDatabase {
  database_id: string;
  database_name: string;
  integration_id: string;
  last_sync: string | null;
  sync_frequency: string;
  properties: {
    [key: string]: {
      type: string;
      required?: boolean;
      description?: string;
    };
  };
}

export default function DatabasePage() {
  const params = useParams();
  const { user } = useUser();
  const databaseId = params.databaseId as string;
  const queryClient = useQueryClient();

  const { data: database, isLoading, error, refetch } = useDatabase(databaseId);
  const [currentView, setCurrentView] = React.useState('table');
  const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [visibleProperties, setVisibleProperties] = React.useState<string[]>([]);
  const [filters, setFilters] = React.useState<FilterState>({ groups: [] });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    cacheUtils.invalidateDatabase(databaseId);
    await refetch();
    setIsRefreshing(false);
  };

  const handleNewEntrySuccess = () => {
    // Refresh the database data when a new entry is created
    cacheUtils.invalidateDatabase(databaseId);
    refetch();
  };

  // Initialize visible properties when database loads
  React.useEffect(() => {
    if (database?.properties && visibleProperties.length === 0) {
      const allPropertyKeys = Object.keys(database.properties);
      setVisibleProperties(allPropertyKeys);
    }
  }, [database?.properties, visibleProperties.length]);

  const handleToggleProperty = (propertyKey: string) => {
    setVisibleProperties((prev) =>
      prev.includes(propertyKey)
        ? prev.filter((key) => key !== propertyKey)
        : [...prev, propertyKey]
    );
  };

  const handleShowAllProperties = () => {
    if (database?.properties) {
      setVisibleProperties(Object.keys(database.properties));
    }
  };

  const handleHideAllProperties = () => {
    setVisibleProperties([]);
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({ groups: [] });
  };

  const getDatabaseIcon = (databaseName?: string) => {
    if (!databaseName) return <Database className="w-5 h-5" />;

    const name = databaseName.toLowerCase();
    if (name.includes('daily') || name.includes('tracking'))
      return <Calendar className="w-5 h-5" />;
    if (name.includes('fitness') || name.includes('workout')) return <Target className="w-5 h-5" />;
    if (name.includes('financial') || name.includes('investment'))
      return <BarChart3 className="w-5 h-5" />;
    if (name.includes('health') || name.includes('wellness')) return <Heart className="w-5 h-5" />;
    return <Database className="w-5 h-5" />;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" label="Loading database..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>
                {error instanceof Error ? error.message : 'Failed to load database'}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!database) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Database not found</CardTitle>
              <CardDescription>The requested database could not be found.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-full mx-auto">
          {/* Breadcrumbs */}
          <nav className="px-6 py-3 text-sm text-muted-foreground border-b border-border">
            <span>Dashboard</span>
            <span className="mx-2">/</span>
            <span>Databases</span>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">{database.database_name}</span>
          </nav>

          {/* Database Cover */}
          {database.cover && (
            <div className="h-48 w-full overflow-hidden">
              {database.cover.type === 'external' ? (
                <img
                  src={database.cover.external.url}
                  alt="Database cover"
                  className="w-full h-full object-cover"
                />
              ) : database.cover.type === 'file' ? (
                <img
                  src={database.cover.file.url}
                  alt="Database cover"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
          )}

          {/* Database Header - Notion Style */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded flex items-center justify-center bg-muted mt-1">
                {database.icon ? (
                  database.icon.type === 'emoji' ? (
                    <span className="text-lg">{database.icon.emoji}</span>
                  ) : database.icon.type === 'external' ? (
                    <img
                      src={database.icon.external.url}
                      alt="Database icon"
                      className="w-6 h-6 rounded"
                    />
                  ) : database.icon.type === 'file' ? (
                    <img
                      src={database.icon.file.url}
                      alt="Database icon"
                      className="w-6 h-6 rounded"
                    />
                  ) : (
                    getDatabaseIcon(database.database_name)
                  )
                ) : (
                  getDatabaseIcon(database.database_name)
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-foreground">{database.database_name}</h1>
                {database.description && database.description.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {database.description
                      .map((block: any) => (block.type === 'text' ? block.text.plain_text : ''))
                      .join('')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notion-style Toolbar with shadcn Tabs */}
          <div className="px-6 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <Tabs value={currentView} onValueChange={setCurrentView} className="w-auto">
                <TabsList className="grid w-auto grid-cols-4">
                  {DATABASE_VIEW_ORDER.map((viewType) => {
                    const config = DATABASE_VIEW_CONFIGS[viewType];
                    const Icon = config.icon;
                    return (
                      <TabsTrigger key={viewType} value={viewType} className="gap-2">
                        <Icon className="w-4 h-4" />
                        {config.name}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <DatabaseSyncSettings
                  databaseId={database.database_id}
                  databaseName={database.database_name}
                  lastSync={database.last_sync}
                  properties={database.properties}
                  onSyncComplete={() => {
                    cacheUtils.invalidateDatabase(databaseId);
                    refetch();
                  }}
                />
                {database?.properties && (
                  <FilterMenu
                    properties={database.properties}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onClearFilters={handleClearFilters}
                  />
                )}
                {database?.properties && (
                  <PropertyVisibilityMenu
                    properties={database.properties}
                    visibleProperties={visibleProperties}
                    onToggleProperty={handleToggleProperty}
                    onShowAll={handleShowAllProperties}
                    onHideAll={handleHideAllProperties}
                  />
                )}
                <button
                  onClick={() => setIsNewEntryDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>
            </div>
          </div>

          {/* Database Content */}
          <div className="flex-1 overflow-hidden relative">
            {isRefreshing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Refreshing...
                </div>
              </div>
            )}
            {currentView === 'table' && (
              <DatabaseTable
                databaseId={database.database_id}
                properties={database.properties}
                visibleProperties={visibleProperties}
                filters={filters}
                emptyState={
                  <EmptyState
                    icon={DATABASE_VIEW_CONFIGS.table.icon}
                    title={DATABASE_VIEW_CONFIGS.table.emptyState.title}
                    description={DATABASE_VIEW_CONFIGS.table.emptyState.description}
                    actionText={DATABASE_VIEW_CONFIGS.table.emptyState.actionText}
                    onAction={() => setIsNewEntryDialogOpen(true)}
                  />
                }
              />
            )}
            {currentView === 'board' && (
              <DatabaseBoardView
                databaseId={database.database_id}
                properties={database.properties}
                filters={filters}
                emptyState={
                  <EmptyState
                    icon={DATABASE_VIEW_CONFIGS.board.icon}
                    title={DATABASE_VIEW_CONFIGS.board.emptyState.title}
                    description={DATABASE_VIEW_CONFIGS.board.emptyState.description}
                    actionText={DATABASE_VIEW_CONFIGS.board.emptyState.actionText}
                    onAction={() => setIsNewEntryDialogOpen(true)}
                  />
                }
              />
            )}
            {currentView === 'calendar' && (
              <DatabaseCalendarView
                databaseId={database.database_id}
                properties={database.properties}
                filters={filters}
                emptyState={
                  <EmptyState
                    icon={DATABASE_VIEW_CONFIGS.calendar.icon}
                    title={DATABASE_VIEW_CONFIGS.calendar.emptyState.title}
                    description={DATABASE_VIEW_CONFIGS.calendar.emptyState.description}
                    actionText={DATABASE_VIEW_CONFIGS.calendar.emptyState.actionText}
                    onAction={() => setIsNewEntryDialogOpen(true)}
                  />
                }
              />
            )}
            {currentView === 'gallery' && (
              <DatabaseGalleryView
                databaseId={database.database_id}
                properties={database.properties}
                filters={filters}
                emptyState={
                  <EmptyState
                    icon={DATABASE_VIEW_CONFIGS.gallery.icon}
                    title={DATABASE_VIEW_CONFIGS.gallery.emptyState.title}
                    description={DATABASE_VIEW_CONFIGS.gallery.emptyState.description}
                    actionText={DATABASE_VIEW_CONFIGS.gallery.emptyState.actionText}
                    onAction={() => setIsNewEntryDialogOpen(true)}
                  />
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* New Entry Dialog */}
      <NewEntryDialog
        isOpen={isNewEntryDialogOpen}
        onClose={() => setIsNewEntryDialogOpen(false)}
        databaseId={database.database_id}
        onSuccess={handleNewEntrySuccess}
      />
    </DashboardLayout>
  );
}
