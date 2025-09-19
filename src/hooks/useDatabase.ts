import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

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

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
  created_time: string;
  last_edited_time: string;
}

interface DatabasePagesResponse {
  pages: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// Hook for fetching database info
export function useDatabase(databaseId: string) {
  return useQuery({
    queryKey: ['database', databaseId],
    queryFn: async (): Promise<NotionDatabase> => {
      // First get all user's databases
      const response = await fetch('/api/user/notion-credentials');
      if (!response.ok) {
        throw new Error('Failed to fetch user databases');
      }
      const databases = await response.json();

      // Find the specific database
      const foundDatabase = databases.find((db: NotionDatabase) => db.database_id === databaseId);
      if (!foundDatabase) {
        throw new Error('Database not found');
      }

      return foundDatabase;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - database properties don't change often
    enabled: !!databaseId,
  });
}

// Hook for fetching database pages with infinite scroll
export function useDatabasePages(databaseId: string, pageSize: number = 50) {
  return useInfiniteQuery({
    queryKey: ['database-pages', databaseId, pageSize],
    queryFn: async ({ pageParam }): Promise<DatabasePagesResponse> => {
      const params = new URLSearchParams({
        databaseId,
        pageSize: pageSize.toString(),
      });

      if (pageParam) {
        params.append('start_cursor', pageParam);
      }

      const response = await fetch(`/api/notion/database/${databaseId}/pages?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch database pages');
      }
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? lastPage.next_cursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!databaseId,
  });
}

// Hook for fetching all database pages at once (for cases where we need all data)
export function useAllDatabasePages(databaseId: string) {
  return useQuery({
    queryKey: ['all-database-pages', databaseId],
    queryFn: async (): Promise<NotionPage[]> => {
      const allPages: NotionPage[] = [];
      let hasMore = true;
      let nextCursor: string | null = null;

      while (hasMore) {
        const params = new URLSearchParams({
          databaseId,
          pageSize: '100', // Use max page size
        });

        if (nextCursor) {
          params.append('start_cursor', nextCursor);
        }

        const response = await fetch(`/api/notion/database/${databaseId}/pages?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch database pages');
        }

        const data: DatabasePagesResponse = await response.json();
        allPages.push(...data.pages);
        hasMore = data.has_more;
        nextCursor = data.next_cursor;
      }

      return allPages;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!databaseId,
  });
}
