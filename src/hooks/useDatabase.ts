import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

interface NotionDatabase {
  title: string;
  properties: Record<
    string,
    {
      type: string;
      name: string;
    }
  >;
  icon?: any;
  cover?: any;
  description?: any[];
  created_time?: string;
  last_edited_time?: string;
  created_by?: any;
  last_edited_by?: any;
}

interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
  created_time: string;
  last_edited_time: string;
  icon?: any;
  cover?: any;
}

interface DatabasePagesResponse {
  pages: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// Hook for fetching database info
export function useDatabase(databaseId: string) {
  console.log('useDatabase called with:', { databaseId });

  return useQuery({
    queryKey: ['database', databaseId],
    queryFn: async ({ signal }): Promise<NotionDatabase> => {
      console.log('useDatabase queryFn called with:', { databaseId });

      const response = await fetch(`/api/notion/database/${databaseId}`, { signal });
      console.log('useDatabase response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('useDatabase API Error:', { status: response.status, errorText });
        throw new Error('Failed to fetch database');
      }

      const data = await response.json();
      console.log('useDatabase response data:', data);
      return data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - database properties don't change often
    enabled: !!databaseId,
  });
}

// Hook for fetching database pages with infinite scroll
export function useDatabasePages(databaseId: string, pageSize: number = 50) {
  console.log('useDatabasePages called with:', { databaseId, pageSize });

  return useInfiniteQuery({
    queryKey: ['database-pages', databaseId, pageSize],
    queryFn: async ({ pageParam }): Promise<DatabasePagesResponse> => {
      console.log('useDatabasePages queryFn called with:', { databaseId, pageSize, pageParam });

      const params = new URLSearchParams({
        pageSize: pageSize.toString(),
      });

      if (pageParam) {
        params.append('start_cursor', pageParam);
      }

      const url = `/api/notion/database/${databaseId}/pages?${params}`;
      console.log('Fetching URL:', url);

      const response = await fetch(url);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', { status: response.status, errorText });
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
