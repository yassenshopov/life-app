'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar, CalendarDays, Cloud, TrendingUp } from 'lucide-react';

export interface HQSection {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  defaultColSpan: number;
}

export const HQ_SECTIONS: HQSection[] = [
  {
    id: 'todayAgenda',
    label: "Today's Agenda",
    description: 'Your tasks and events for today',
    icon: <Calendar className="h-4 w-4" />,
    defaultColSpan: 1,
  },
  {
    id: 'weekAgenda',
    label: '7-Day Agenda',
    description: 'Your upcoming week overview',
    icon: <CalendarDays className="h-4 w-4" />,
    defaultColSpan: 2,
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Current weather conditions',
    icon: <Cloud className="h-4 w-4" />,
    defaultColSpan: 1,
  },
  {
    id: 'healthMetrics',
    label: 'Health Metrics Trends',
    description: 'Your health tracking data and trends',
    icon: <TrendingUp className="h-4 w-4" />,
    defaultColSpan: 3,
  },
];

interface HQSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Record<string, { visible: boolean }>;
  onSave: (preferences: Record<string, { visible: boolean }>) => Promise<void>;
  onPreferencesChange?: (preferences: Record<string, { visible: boolean }>) => void;
}

export function HQSettingsDialog({
  isOpen,
  onClose,
  preferences,
  onSave,
  onPreferencesChange,
}: HQSettingsDialogProps) {
  const [localPreferences, setLocalPreferences] = React.useState<
    Record<string, { visible: boolean }>
  >(preferences);
  const [isSaving, setIsSaving] = React.useState(false);
  const hasChangesRef = React.useRef(false);

  // Update local preferences when dialog opens or preferences change
  React.useEffect(() => {
    if (isOpen) {
      setLocalPreferences(preferences);
      hasChangesRef.current = false;
    }
  }, [isOpen, preferences]);

  const handleToggle = (sectionId: string) => {
    const newPreferences = {
      ...localPreferences,
      [sectionId]: {
        visible: !(localPreferences[sectionId]?.visible ?? true),
      },
    };
    setLocalPreferences(newPreferences);
    hasChangesRef.current = true;
    // Optimistically update the page
    if (onPreferencesChange) {
      onPreferencesChange(newPreferences);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(localPreferences);
      hasChangesRef.current = false;
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      // Revert optimistic update on error
      if (onPreferencesChange) {
        onPreferencesChange(preferences);
      }
      setLocalPreferences(preferences);
      hasChangesRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = React.useCallback(() => {
    // Only revert if there were unsaved changes
    if (hasChangesRef.current && onPreferencesChange) {
      onPreferencesChange(preferences);
    }
    setLocalPreferences(preferences);
    hasChangesRef.current = false;
    // Close the dialog after reverting changes
    if (onClose) {
      onClose();
    }
  }, [preferences, onPreferencesChange, onClose]);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      // Dialog is closing - revert changes and close
      handleCancel();
    }
  }, [handleCancel]);

  // Helper to check if a section is visible
  const isSectionVisible = (sectionId: string): boolean => {
    return localPreferences[sectionId]?.visible ?? true;
  };

  // Calculate grid layout for preview
  const getSectionColSpan = (sectionId: string): number => {
    if (!isSectionVisible(sectionId)) return 0;
    
    const section = HQ_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;

    // Today's Agenda: 1 if visible, else weekAgenda takes 3
    if (sectionId === 'todayAgenda') return 1;
    
    // Week Agenda: 2 if todayAgenda is visible, else 3
    if (sectionId === 'weekAgenda') {
      return isSectionVisible('todayAgenda') ? 2 : 3;
    }
    
    // Weather: 1 if healthMetrics is visible, else 3
    if (sectionId === 'weather') {
      return isSectionVisible('healthMetrics') ? 1 : 3;
    }
    
    // Health Metrics: 2 if weather is visible, else 3
    if (sectionId === 'healthMetrics') {
      return isSectionVisible('weather') ? 2 : 3;
    }
    
    return section.defaultColSpan;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>HQ Page Settings</DialogTitle>
          <DialogDescription>
            Choose which sections to display on your HQ page
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview Grid */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Layout Preview</Label>
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/30 min-h-[120px]">
              {/* Render sections in the order they appear on the page */}
              {['todayAgenda', 'weekAgenda', 'weather', 'healthMetrics'].map((sectionId) => {
                const section = HQ_SECTIONS.find((s) => s.id === sectionId);
                if (!section) return null;
                
                const colSpan = getSectionColSpan(section.id);
                const isVisible = isSectionVisible(section.id);
                
                if (!isVisible) return null;

                return (
                  <div
                    key={section.id}
                    className={`rounded-md border-2 border-dashed p-2 bg-background/50 flex items-center gap-2 text-xs transition-all ${
                      isVisible
                        ? 'border-primary/50 opacity-100'
                        : 'border-muted opacity-30'
                    }`}
                    style={{
                      gridColumn: `span ${colSpan}`,
                    }}
                  >
                    <div className="text-muted-foreground shrink-0">
                      {section.icon}
                    </div>
                    <span className="font-medium truncate">{section.label}</span>
                  </div>
                );
              })}
              {HQ_SECTIONS.filter((s) => isSectionVisible(s.id)).length === 0 && (
                <div className="col-span-3 text-center text-xs text-muted-foreground py-4">
                  No sections selected
                </div>
              )}
            </div>
          </div>

          {/* Section Checkboxes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sections</Label>
            <div className="space-y-2">
              {HQ_SECTIONS.map((section) => {
                const isVisible = localPreferences[section.id]?.visible ?? true;
                return (
                  <div
                    key={section.id}
                    className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleToggle(section.id)}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center"
                    >
                      <Checkbox
                        id={section.id}
                        checked={isVisible}
                        onCheckedChange={() => handleToggle(section.id)}
                        className="mt-0.5"
                      />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground">
                          {section.icon}
                        </div>
                        <Label
                          htmlFor={section.id}
                          className="text-sm font-medium leading-none cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {section.label}
                        </Label>
                      </div>
                      {section.description && (
                        <p className="text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

