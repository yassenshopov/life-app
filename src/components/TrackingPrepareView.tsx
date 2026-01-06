'use client';

import React, { useState } from 'react';
import { Calendar, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GenerateProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'completed' | 'error';
  message: string;
  error?: string;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function TrackingPrepareView() {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);

  // Generate years from current year + 5 to current year + 10
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => (currentYear + i).toString());
  
  // Calculate days in year based on selectedYear or current year
  const year = selectedYear ? parseInt(selectedYear, 10) : currentYear;
  const daysInYear = isLeapYear(year) ? 366 : 365;

  const handleGenerate = async () => {
    if (!selectedYear) return;

    setIsGenerating(true);
    setProgress({
      current: 0,
      total: 365, // Will be adjusted for leap years
      status: 'preparing',
      message: 'Preparing to generate daily entries...'
    });
    setShowProgressDialog(true);

    try {
      const response = await fetch('/api/tracking/prepare/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: parseInt(selectedYear),
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate entries';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // If not JSON, try to get text content
            const textContent = await response.text();
            errorMessage = textContent || errorMessage;
          }
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Handle streaming progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const progressData = JSON.parse(line.slice(6));
                setProgress(progressData);

                // If completed or error, stop reading
                if (progressData.status === 'completed' || progressData.status === 'error') {
                  reader.cancel();
                  return;
                }
              } catch (e) {
                console.error('Failed to parse progress data:', e);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error generating entries:', error);
      setProgress(prev => prev ? {
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      } : null);
    } finally {
      setIsGenerating(false);
    }
  };

  const getProgressColor = () => {
    if (!progress) return 'bg-blue-500';
    switch (progress.status) {
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusIcon = () => {
    if (!progress) return null;
    switch (progress.status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Calendar className="w-5 h-5 text-blue-500 animate-pulse" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Prepare Year Ahead
          </CardTitle>
          <CardDescription>
            Generate all daily tracking entries for an upcoming year. This will create entries in your Notion Daily Tracking database with the naming convention "Dec 11 '25".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label htmlFor="year-select" className="text-sm font-medium">
                Select Year
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <Button
              onClick={handleGenerate}
              disabled={!selectedYear || isGenerating}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate Entries'}
            </Button>
          </div>

          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              This will create {daysInYear} daily entries
              and 52 weekly entries (if Weekly Tracking database is connected)
              for {selectedYear || 'the selected year'} in your Notion databases.
              Make sure your Daily Tracking database is connected before proceeding.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStatusIcon()}
              Generating Daily Entries
            </DialogTitle>
            <DialogDescription>
              Creating daily tracking entries for {selectedYear}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {progress && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress.current} / {progress.total}</span>
                  </div>
                  <Progress
                    value={(progress.current / progress.total) * 100}
                    className="w-full"
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  {progress.message}
                </p>

                {progress.status === 'error' && progress.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {progress.error}
                    </AlertDescription>
                  </Alert>
                )}

                {progress.status === 'completed' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      All entries have been successfully generated!
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              {progress?.status === 'completed' || progress?.status === 'error' ? (
                <Button onClick={() => setShowProgressDialog(false)}>
                  Close
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowProgressDialog(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
