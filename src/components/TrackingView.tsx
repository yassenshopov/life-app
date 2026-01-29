'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConnectTrackingDbDialog } from '@/components/dialogs/ConnectTrackingDbDialog';
import { cn } from '@/lib/utils';
import { TrackingCalendarView } from '@/components/TrackingCalendarView';
import { TrackingWeeklyView } from '@/components/TrackingWeeklyView';
import { TrackingMonthlyView } from '@/components/TrackingMonthlyView';
import { TrackingQuarterlyView } from '@/components/TrackingQuarterlyView';
import { TrackingYearlyView } from '@/components/TrackingYearlyView';
import { TrackingEntryDetailModal } from '@/components/TrackingEntryDetailModal';
import { HealthMetricsTrends } from '@/components/HealthMetricsTrends';
import { TrackingPrepareView } from '@/components/TrackingPrepareView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'prepare';

export interface TrackingEntry {
  id: string;
  notion_page_id: string;
  notion_database_id: string;
  period: TrackingPeriod;
  title: string;
  properties: Record<string, { type: string; value: any }>;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string;
}

interface ConnectionInfo {
  period: TrackingPeriod;
  connected: boolean;
  database?: any;
}

const PERIOD_LABELS: Record<TrackingPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  daily: 'Daily View',
  weekly: 'Weekly View',
  monthly: 'Monthly View',
  quarterly: 'Quarterly View',
  yearly: 'Yearly View',
  prepare: 'Prepare Year',
};

const PERIOD_ICONS: Record<TrackingPeriod, string> = {
  daily: '📅',
  weekly: '📆',
  monthly: '🗓️',
  quarterly: '📊',
  yearly: '📈',
};

// Helper to format property value from stored JSONB format
export function formatStoredPropertyValue(prop: { type: string; value: any } | undefined): string {
  if (!prop || prop.value === null || prop.value === undefined) return '';

  const { type, value } = prop;

  // Helper to safely extract value from nested objects
  const extractValue = (val: any): any => {
    if (val === null || val === undefined) return null;
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) return val;

    // Try common Notion property structures
    if (val.title?.[0]?.plain_text) return val.title[0].plain_text;
    if (val.rich_text?.[0]?.plain_text) return val.rich_text[0].plain_text;
    if (val.select?.name) return val.select.name;
    if (val.date) return val.date;
    if (val.number !== undefined) return val.number;
    if (val.checkbox !== undefined) return val.checkbox;
    if (val.url) return val.url;
    if (val.email) return val.email;
    if (val.phone_number) return val.phone_number;
    if (val.multi_select) return val.multi_select;
    if (val.relation) return val.relation;
    if (val.formula) return val.formula;
    if (val.rollup) return val.rollup;

    return val;
  };

  const extractedValue = extractValue(value);

  switch (type) {
    case 'title':
      return typeof extractedValue === 'string' ? extractedValue : '';
    case 'rich_text':
      return typeof extractedValue === 'string' ? extractedValue : '';
    case 'select':
      if (typeof extractedValue === 'string') return extractedValue;
      if (extractedValue?.name) return extractedValue.name;
      return '';
    case 'multi_select':
      if (Array.isArray(extractedValue)) {
        return extractedValue
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.name) return item.name;
            return String(item);
          })
          .join(', ');
      }
      return '';
    case 'date':
      if (typeof extractedValue === 'string') {
        try {
          return new Date(extractedValue).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          return extractedValue;
        }
      }
      if (extractedValue?.start) {
        const start = new Date(extractedValue.start).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        if (extractedValue.end && extractedValue.end !== extractedValue.start) {
          const end = new Date(extractedValue.end).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          return `${start} - ${end}`;
        }
        return start;
      }
      return '';
    case 'number':
      if (typeof extractedValue === 'number') {
        return extractedValue.toLocaleString();
      }
      if (typeof extractedValue === 'string') {
        const num = parseFloat(extractedValue);
        return isNaN(num) ? extractedValue : num.toLocaleString();
      }
      return '';
    case 'checkbox':
      return extractedValue ? 'Yes' : 'No';
    case 'url':
      return typeof extractedValue === 'string' ? extractedValue : extractedValue?.url || '';
    case 'email':
      return typeof extractedValue === 'string' ? extractedValue : extractedValue?.email || '';
    case 'phone_number':
      return typeof extractedValue === 'string'
        ? extractedValue
        : extractedValue?.phone_number || '';
    case 'relation':
      if (Array.isArray(extractedValue)) {
        // Relations are stored as IDs, show count or IDs
        if (extractedValue.length === 0) return '';
        if (extractedValue.length === 1) {
          const id =
            typeof extractedValue[0] === 'string' ? extractedValue[0] : extractedValue[0]?.id;
          return id ? `${id.slice(0, 8)}...` : '';
        }
        return `${extractedValue.length} relations`;
      }
      return '';
    case 'formula':
      // Formula can return various types
      if (extractedValue === null || extractedValue === undefined) return '';
      if (
        typeof extractedValue === 'string' ||
        typeof extractedValue === 'number' ||
        typeof extractedValue === 'boolean'
      ) {
        return String(extractedValue);
      }
      if (extractedValue.type === 'string' && extractedValue.string) return extractedValue.string;
      if (extractedValue.type === 'number' && extractedValue.number !== undefined)
        return String(extractedValue.number);
      if (extractedValue.type === 'boolean' && extractedValue.boolean !== undefined)
        return extractedValue.boolean ? 'Yes' : 'No';
      if (extractedValue.type === 'date' && extractedValue.date) {
        const dateVal = extractedValue.date.start || extractedValue.date;
        return new Date(dateVal).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      // Fallback for complex formula results
      return 'Formula';
    case 'rollup':
      // Rollup can return various types
      if (extractedValue === null || extractedValue === undefined) return '';
      if (extractedValue.type === 'number' && extractedValue.number !== undefined) {
        return extractedValue.number.toLocaleString();
      }
      if (extractedValue.type === 'date' && extractedValue.date) {
        const dateVal = extractedValue.date.start || extractedValue.date;
        return new Date(dateVal).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      if (extractedValue.type === 'array' && Array.isArray(extractedValue.array)) {
        return `${extractedValue.array.length} items`;
      }
      // Fallback for complex rollup results
      return 'Rollup';
    case 'created_time':
    case 'last_edited_time':
      if (typeof extractedValue === 'string') {
        try {
          return new Date(extractedValue).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          return extractedValue;
        }
      }
      return '';
    default:
      // For unknown types, try to extract a meaningful string
      if (
        typeof extractedValue === 'string' ||
        typeof extractedValue === 'number' ||
        typeof extractedValue === 'boolean'
      ) {
        return String(extractedValue);
      }
      if (Array.isArray(extractedValue)) {
        return `${extractedValue.length} items`;
      }
      // Last resort: return empty string instead of [object Object]
      return '';
  }
}

// Cookie helper functions
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

interface TrackingViewProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function TrackingView({ colorPalette }: TrackingViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('tracking-view-mode');
      if (
        saved &&
        ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'prepare'].includes(saved)
      ) {
        return saved as ViewMode;
      }
    }
    return 'daily';
  });
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connections, setConnections] = useState<Record<TrackingPeriod, ConnectionInfo>>({
    daily: { period: 'daily', connected: false },
    weekly: { period: 'weekly', connected: false },
    monthly: { period: 'monthly', connected: false },
    quarterly: { period: 'quarterly', connected: false },
    yearly: { period: 'yearly', connected: false },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TrackingEntry | null>(null);

  // Check connection status for all periods
  useEffect(() => {
    checkConnections();
  }, []);

  // Fetch daily entries when connected
  useEffect(() => {
    if (connections.daily.connected) {
      fetchEntries('daily');
    }
  }, [connections.daily.connected]);

  const checkConnections = async () => {
    try {
      const response = await fetch('/api/tracking/connections');
      const data = await response.json();

      if (data.connections) {
        // Use functional updater to avoid stale closure
        setConnections((prev) => {
          const updatedConnections = { ...prev };
          Object.keys(data.connections).forEach((period) => {
            const conn = data.connections[period];
            updatedConnections[period as TrackingPeriod] = {
              period: period as TrackingPeriod,
              connected: conn.connected,
              database: conn.database,
            };
          });
          return updatedConnections;
        });
      }
    } catch (error) {
      console.error('Error checking connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEntries = async (period: TrackingPeriod) => {
    try {
      const response = await fetch(`/api/tracking/${period}`);
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error(`Error fetching ${period} entries:`, error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/tracking/daily/sync', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        await fetchEntries('daily');
        await checkConnections();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnected = (period: TrackingPeriod) => {
    checkConnections();
    if (period === 'daily') {
      fetchEntries('daily');
    }
  };

  const handleNavigateMonth = (date: Date) => {
    setCurrentMonth(date);
  };

  const handleNavigateWeek = (date: Date) => {
    setCurrentWeek(date);
  };

  const handleNavigateYear = (date: Date) => {
    setCurrentYear(date);
  };

  const handleEntryClick = (entry: TrackingEntry) => {
    setSelectedEntry(entry);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isDailyConnected = connections.daily.connected;

  if (!isDailyConnected) {
    return (
      <div className="min-h-screen bg-background">
        {/* Empty State */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <Card className="p-12 text-center">
            <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Tracking Databases</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your Notion Daily, Weekly, Monthly, Quarterly, and Yearly tracking databases
              to sync and view your entries.
            </p>
            <Button
              onClick={() => {
                setShowConnectDialog(true);
              }}
              size="lg"
            >
              <Database className="w-4 h-4 mr-2" />
              Connect Daily Database
            </Button>
          </Card>
        </div>

        <ConnectTrackingDbDialog
          isOpen={showConnectDialog}
          onClose={() => {
            setShowConnectDialog(false);
          }}
          onConnected={(period) => {
            handleConnected(period);
            setShowConnectDialog(false);
          }}
          defaultPeriod="daily"
        />
      </div>
    );
  }

  // Apply color palette to main container if available
  const containerStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.05)'),
      }
    : undefined;

  return (
    <div className="min-h-screen" style={containerStyle || { backgroundColor: 'var(--background)' }}>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh from Notion"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>

        {/* Health Metrics Trends */}
        {viewMode !== 'prepare' && (
          <HealthMetricsTrends
            entries={entries}
            viewMode={viewMode as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'}
            colorPalette={colorPalette}
          />
        )}

        {/* View Tabs */}
        <Tabs
          value={viewMode as any}
          onValueChange={(value: string) => {
            const newMode = value as ViewMode;
            setViewMode(newMode);
            setCookie('tracking-view-mode', newMode);
          }}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly View</TabsTrigger>
            <TabsTrigger value="yearly">Yearly View</TabsTrigger>
            <TabsTrigger value="prepare">Prepare Year</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-0">
            <TrackingCalendarView
              entries={entries}
              currentMonth={currentMonth}
              onNavigate={handleNavigateMonth}
              onEntryClick={handleEntryClick}
              colorPalette={colorPalette}
            />
          </TabsContent>

          <TabsContent value="weekly" className="mt-0">
            <TrackingWeeklyView
              entries={entries}
              currentWeek={currentWeek}
              onNavigate={handleNavigateWeek}
              colorPalette={colorPalette}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-0">
            <TrackingMonthlyView
              entries={entries}
              currentYear={currentYear}
              onNavigate={handleNavigateYear}
              colorPalette={colorPalette}
            />
          </TabsContent>

          <TabsContent value="quarterly" className="mt-0">
            <TrackingQuarterlyView
              entries={entries}
              currentYear={currentYear}
              onNavigate={handleNavigateYear}
              colorPalette={colorPalette}
            />
          </TabsContent>

          <TabsContent value="yearly" className="mt-0">
            <TrackingYearlyView
              entries={entries}
              currentYear={currentYear}
              onNavigate={handleNavigateYear}
              colorPalette={colorPalette}
            />
          </TabsContent>

          <TabsContent value="prepare" className="mt-0">
            <TrackingPrepareView />
          </TabsContent>
        </Tabs>
      </div>

      <ConnectTrackingDbDialog
        isOpen={showConnectDialog}
        onClose={() => {
          setShowConnectDialog(false);
        }}
        onConnected={(period) => {
          handleConnected(period);
          setShowConnectDialog(false);
        }}
        defaultPeriod="daily"
      />

      <TrackingEntryDetailModal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
        allEntries={entries}
      />
    </div>
  );
}
