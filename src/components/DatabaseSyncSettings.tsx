'use client';

import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  Edit3,
  Clock,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatPropertyValue } from '@/lib/notion-property-utils';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';

// Debug the import
console.log('DatabaseSyncSettings NOTION_PROPERTY_TYPES:', NOTION_PROPERTY_TYPES);

interface DatabaseSyncSettingsProps {
  databaseId: string;
  databaseName: string;
  lastSync: string | null;
  properties: Record<string, any>;
  onSyncComplete?: () => void;
}

interface SyncResult {
  success: boolean;
  lastSync: string;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  properties: Record<string, any>;
  error?: string;
}

export function DatabaseSyncSettings({
  databaseId,
  databaseName,
  lastSync,
  properties,
  onSyncComplete,
}: DatabaseSyncSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch(`/api/notion/database/${databaseId}/sync`, {
        method: 'POST',
      });

      const result = await response.json();
      setSyncResult(result);

      if (result.success && onSyncComplete) {
        onSyncComplete();
        // Dispatch custom event to notify sidebar of sync completion
        window.dispatchEvent(
          new CustomEvent('database-synced', {
            detail: { databaseId },
          })
        );
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncResult({
        success: false,
        lastSync: lastSync || '',
        changes: { added: [], removed: [], modified: [] },
        properties: {},
        error: 'Failed to sync database',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (syncTime: string | null) => {
    if (!syncTime) return 'Never synced';
    return new Date(syncTime).toLocaleString();
  };

  const getPropertyTypeIcon = (type: string) => {
    // Debug logging
    console.log('getPropertyTypeIcon called with:', { type, NOTION_PROPERTY_TYPES });

    // Check if NOTION_PROPERTY_TYPES is defined
    if (!NOTION_PROPERTY_TYPES) {
      console.error('NOTION_PROPERTY_TYPES is undefined');
      return '❓';
    }

    switch (type) {
      case NOTION_PROPERTY_TYPES.TITLE:
        return '📝';
      case NOTION_PROPERTY_TYPES.RICH_TEXT:
        return '📄';
      case NOTION_PROPERTY_TYPES.SELECT:
        return '🏷️';
      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return '🏷️';
      case NOTION_PROPERTY_TYPES.DATE:
        return '📅';
      case NOTION_PROPERTY_TYPES.NUMBER:
        return '🔢';
      case NOTION_PROPERTY_TYPES.CHECKBOX:
        return '☑️';
      case NOTION_PROPERTY_TYPES.STATUS:
        return '📊';
      case NOTION_PROPERTY_TYPES.PEOPLE:
        return '👥';
      case NOTION_PROPERTY_TYPES.URL:
        return '🔗';
      case NOTION_PROPERTY_TYPES.EMAIL:
        return '📧';
      case NOTION_PROPERTY_TYPES.PHONE:
        return '📞';
      default:
        return '❓';
    }
  };

  const hasChanges =
    syncResult &&
    syncResult.changes &&
    (syncResult.changes.added?.length > 0 ||
      syncResult.changes.removed?.length > 0 ||
      syncResult.changes.modified?.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Database sync settings">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Sync Settings - {databaseName}
          </DialogTitle>
          <DialogDescription>
            Manage database synchronization and view property changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sync Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Sync Status</CardTitle>
                <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Last synced: {formatLastSync(lastSync)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Sync Results */}
          {syncResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {syncResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  Sync Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncResult.success ? (
                  <div className="space-y-4">
                    {hasChanges ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Changes detected:</span>
                        </div>

                        {syncResult.changes?.added?.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-green-600">
                              <Plus className="w-4 h-4" />
                              <span className="font-medium">
                                Added Properties ({syncResult.changes.added.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {syncResult.changes?.added?.map((prop) => (
                                <Badge
                                  key={prop}
                                  variant="secondary"
                                  className="bg-green-100 text-green-800"
                                >
                                  {prop}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {syncResult.changes?.removed?.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-600">
                              <Minus className="w-4 h-4" />
                              <span className="font-medium">
                                Removed Properties ({syncResult.changes.removed.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {syncResult.changes?.removed?.map((prop) => (
                                <Badge
                                  key={prop}
                                  variant="secondary"
                                  className="bg-red-100 text-red-800"
                                >
                                  {prop}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {syncResult.changes?.modified?.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-orange-600">
                              <Edit3 className="w-4 h-4" />
                              <span className="font-medium">
                                Modified Properties ({syncResult.changes.modified.length})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {syncResult.changes?.modified?.map((prop) => (
                                <Badge
                                  key={prop}
                                  variant="secondary"
                                  className="bg-orange-100 text-orange-800"
                                >
                                  {prop}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p>No changes detected. Database is up to date.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-red-600">
                    <XCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>Sync failed: {syncResult.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Properties */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Properties</CardTitle>
              <CardDescription>
                All properties currently configured for this database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {Object.entries(properties).map(([key, property]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getPropertyTypeIcon(property.type)}</span>
                        <div>
                          <div className="font-medium">{key}</div>
                          <div className="text-sm text-muted-foreground">
                            {property.type}
                            {property.required && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {property.description && (
                          <div className="max-w-xs truncate">{property.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
