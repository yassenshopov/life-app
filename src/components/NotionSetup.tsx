'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import {
  NOTION_DATABASE_TEMPLATES,
  type NotionDatabaseTemplate,
} from '@/constants/notion-templates';

/** Notion title can be a string or a rich text object/array (e.g. { plain_text, type, annotations }). */
function getDatabaseTitle(name: unknown): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    const obj = name as { plain_text?: string };
    if (typeof obj.plain_text === 'string') return obj.plain_text;
  }
  if (Array.isArray(name)) {
    return name
      .map((seg) =>
        seg && typeof seg === 'object' && 'plain_text' in seg
          ? (seg as { plain_text: string }).plain_text
          : ''
      )
      .join('');
  }
  return 'Untitled Database';
}

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
  icon?: any;
  cover?: any;
  description?: any[];
  created_time?: string;
  last_edited_time?: string;
  created_by?: any;
  last_edited_by?: any;
}

export default function NotionSetup() {
  const { user } = useUser();
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionDatabaseName, setNotionDatabaseName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<NotionDatabaseTemplate | null>(null);
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProperties, setIsFetchingProperties] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      // Fetch user's notion_databases directly from Supabase
      const fetchDatabases = async () => {
        try {
          const response = await fetch('/api/user/notion-credentials');
          if (response.ok) {
            const data = await response.json();
            setDatabases(data);
          }
        } catch (error) {
          console.error('Error fetching databases:', error);
        }
      };
      fetchDatabases();
    }
  }, [user]);

  const uniqueDatabases = useMemo(() => {
    const seen = new Set<string>();
    return databases.filter((db) => {
      if (seen.has(db.database_id)) return false;
      seen.add(db.database_id);
      return true;
    });
  }, [databases]);

  const extractDatabaseId = (url: string) => {
    const match = url.match(/[a-zA-Z0-9]{32}/);
    return match ? match[0] : url;
  };

  const fetchDatabaseProperties = async (databaseId: string) => {
    setIsFetchingProperties(true);
    setError(null);
    try {
      const response = await fetch(`/api/notion/database/${databaseId}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to continue');
        }
        if (response.status === 404) {
          throw new Error('Database not found. Please check the database ID');
        }
        throw new Error('Failed to fetch database properties');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch database properties');
      return null;
    } finally {
      setIsFetchingProperties(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to continue');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const databaseId = extractDatabaseId(notionDatabaseId);

      // Try to fetch database properties from Notion API
      const databaseData = await fetchDatabaseProperties(databaseId);

      // If we can't fetch properties, use the selected template's properties
      const properties = databaseData?.properties || selectedTemplate?.properties || {};
      const title = databaseData?.title || selectedTemplate?.name || 'Untitled Database';

      const response = await fetch('/api/user/notion-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          database_id: databaseId,
          database_name: notionDatabaseName || title,
          properties: properties,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to continue');
        }
        throw new Error('Failed to save Notion database');
      }

      const newDatabase = await response.json();
      setDatabases((prev) => [...prev, newDatabase]);
      setNotionDatabaseId('');
      setNotionDatabaseName('');
      setSelectedTemplate(null);
      setIsDialogOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save Notion database');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDatabase = async (databaseId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/user/notion-credentials', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ database_id: databaseId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete Notion database');
      }

      setDatabases((prev) => prev.filter((db) => db.database_id !== databaseId));
    } catch (error) {
      console.error('Error deleting Notion database:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Notion Databases</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Notion databases to sync data
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Database
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Notion Database</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Database Template</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {NOTION_DATABASE_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant={selectedTemplate?.id === template.id ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setNotionDatabaseName(template.name);
                        }}
                      >
                        <template.icon className="w-4 h-4 mr-2" />
                        <div className="text-left">
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {template.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="databaseName">Database Name</Label>
                  <Input
                    id="databaseName"
                    value={notionDatabaseName}
                    onChange={(e) => setNotionDatabaseName(e.target.value)}
                    placeholder={selectedTemplate?.name || 'Enter database name'}
                  />
                </div>

                <div>
                  <Label htmlFor="databaseId">Database ID or URL</Label>
                  <Input
                    id="databaseId"
                    value={notionDatabaseId}
                    onChange={(e) => setNotionDatabaseId(e.target.value)}
                    placeholder="Enter Notion database ID or URL"
                  />
                </div>
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || isFetchingProperties}>
                  {isLoading || isFetchingProperties ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      {isFetchingProperties ? 'Fetching Properties...' : 'Adding...'}
                    </>
                  ) : (
                    'Add Database'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {uniqueDatabases.map((database) => (
          <Card key={database.database_id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                {database.icon ? (
                  database.icon.type === 'emoji' ? (
                    <span className="text-lg">{database.icon.emoji}</span>
                  ) : database.icon.type === 'external' ? (
                    <img
                      src={database.icon.external.url}
                      alt="Database icon"
                      className="w-4 h-4 rounded"
                    />
                  ) : database.icon.type === 'file' ? (
                    <img
                      src={database.icon.file.url}
                      alt="Database icon"
                      className="w-4 h-4 rounded"
                    />
                  ) : (
                    <Database className="w-4 h-4" />
                  )
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <CardTitle className="text-base">{getDatabaseTitle(database.database_name)}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteDatabase(database.database_id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <CardDescription>ID: {database.database_id}</CardDescription>
                <div className="flex items-center space-x-2">
                  {database.last_sync ? (
                    <div className="flex items-center text-sm text-green-500">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Synced
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-red-500">
                      <XCircle className="w-4 h-4 mr-1" />
                      Not Synced
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {databases.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No databases connected yet</div>
        )}
      </div>
    </div>
  );
}
