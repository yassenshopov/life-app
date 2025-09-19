'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  User,
  Calendar,
  Clock,
  List,
  ArrowUpRight,
  Tag,
  Star,
  X,
  Plus,
  Edit,
  Trash2,
  Copy,
  Share,
  MoreHorizontal,
  Check,
  Save,
} from 'lucide-react';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';
import { useUpdateEntry } from '@/hooks/useUpdateEntry';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';
import { createNotionPropertyValue } from '@/lib/notion-property-utils';
import { NotionBadgeList } from '@/components/NotionBadge';

interface EntryPeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: any;
  properties: Record<string, any>;
  onUpdate?: (entryId: string, updates: Record<string, any>) => void;
  onDelete?: (entryId: string) => void;
}

export function EntryPeekModal({
  isOpen,
  onClose,
  entry,
  properties,
  onUpdate,
  onDelete,
}: EntryPeekModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { updateEntry, isLoading: isUpdating } = useUpdateEntry({
    onSuccess: (updatedEntry) => {
      setHasChanges(false);
      onUpdate?.(entry.id, updatedEntry);
    },
    onError: (error) => {
      console.error('Failed to update entry:', error);
    },
  });

  // Initialize form data when entry changes
  useEffect(() => {
    if (entry) {
      const initialData: Record<string, any> = {};
      const initialMultiSelect: Record<string, string[]> = {};

      Object.entries(properties).forEach(([key, prop]) => {
        const value = entry.properties[key];
        if (value) {
          switch (prop.type) {
            case NOTION_PROPERTY_TYPES.TITLE:
              initialData[key] = value.title?.[0]?.plain_text || '';
              break;
            case NOTION_PROPERTY_TYPES.RICH_TEXT:
              initialData[key] = value.rich_text?.[0]?.plain_text || '';
              break;
            case NOTION_PROPERTY_TYPES.SELECT:
              initialData[key] = value.select?.name || '';
              break;
            case NOTION_PROPERTY_TYPES.MULTI_SELECT:
              initialMultiSelect[key] = value.multi_select?.map((item: any) => item.name) || [];
              break;
            case NOTION_PROPERTY_TYPES.DATE:
              initialData[key] = value.date?.start || '';
              break;
            case NOTION_PROPERTY_TYPES.PEOPLE:
              initialData[key] = value.people?.map((person: any) => person.name || person) || [];
              break;
            case NOTION_PROPERTY_TYPES.NUMBER:
              initialData[key] = value.number || '';
              break;
            case NOTION_PROPERTY_TYPES.CHECKBOX:
              initialData[key] = value.checkbox || false;
              break;
            default:
              initialData[key] = String(value);
          }
        }
      });

      setFormData(initialData);
      setMultiSelectValues(initialMultiSelect);
      setHasChanges(false);
    }
  }, [entry, properties]);

  const handleFieldChange = (propertyKey: string, value: any) => {
    setFormData((prev) => ({ ...prev, [propertyKey]: value }));
    setHasChanges(true);
  };

  const handleMultiSelectChange = (propertyKey: string, values: string[]) => {
    setMultiSelectValues((prev) => ({ ...prev, [propertyKey]: values }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!entry || !hasChanges) return;

    const updateProperties: Record<string, any> = {};

    Object.entries(properties).forEach(([key, prop]) => {
      // Skip PEOPLE properties until proper writer is implemented
      if (prop.type === NOTION_PROPERTY_TYPES.PEOPLE) {
        return;
      }

      const value = formData[key];
      const multiSelectValue = multiSelectValues[key];

      if (value !== undefined) {
        updateProperties[key] = createNotionPropertyValue(value, prop.type);
      }

      if (multiSelectValue !== undefined) {
        updateProperties[key] = createNotionPropertyValue(
          multiSelectValue,
          NOTION_PROPERTY_TYPES.MULTI_SELECT
        );
      }
    });

    await updateEntry(entry.id, entry.parent?.database_id || '', updateProperties);
  };

  const handleDelete = () => {
    if (entry) {
      setDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    if (onDelete && entry) {
      onDelete(entry.id);
      onClose();
    }
    setDeleteDialogOpen(false);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const getPropertyValue = (propertyKey: string, property: any) => {
    const value = formData[propertyKey];
    const multiSelectValue = multiSelectValues[propertyKey];

    if (multiSelectValue !== undefined) {
      return multiSelectValue;
    }

    return value;
  };

  const getEntryTitle = () => {
    const titleProperty = Object.entries(properties).find(
      ([_, prop]) => prop.type === NOTION_PROPERTY_TYPES.TITLE
    );
    if (titleProperty) {
      const [titleKey] = titleProperty;
      return formData[titleKey] || 'Untitled';
    }
    return 'Untitled';
  };

  if (!entry) return null;

  // Sort properties: title first, then others
  const sortedProperties = Object.entries(properties).sort(([, propA], [, propB]) => {
    if (propA.type === NOTION_PROPERTY_TYPES.TITLE) return -1;
    if (propB.type === NOTION_PROPERTY_TYPES.TITLE) return 1;
    return propA.name.localeCompare(propB.name);
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Entry Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {sortedProperties.map(([propertyKey, property]) => {
              const value = getPropertyValue(propertyKey, property);
              const isTitle = property.type === NOTION_PROPERTY_TYPES.TITLE;

              return (
                <div key={propertyKey} className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    {isTitle ? (
                      <Star className="h-4 w-4" />
                    ) : property.type === NOTION_PROPERTY_TYPES.DATE ? (
                      <Calendar className="h-4 w-4" />
                    ) : property.type === NOTION_PROPERTY_TYPES.PEOPLE ? (
                      <User className="h-4 w-4" />
                    ) : property.type === NOTION_PROPERTY_TYPES.MULTI_SELECT ? (
                      <Tag className="h-4 w-4" />
                    ) : property.type === NOTION_PROPERTY_TYPES.SELECT ? (
                      <List className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                    {property.name}
                  </Label>

                  {isTitle ? (
                    <div className="space-y-2">
                      <Textarea
                        value={value || ''}
                        onChange={(e) => handleFieldChange(propertyKey, e.target.value)}
                        placeholder="Untitled"
                        className="text-lg font-semibold min-h-[60px] resize-none border-none shadow-none focus-visible:ring-1"
                        onBlur={handleSave}
                      />
                      {hasChanges && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          Unsaved changes
                        </div>
                      )}
                    </div>
                  ) : property.type === NOTION_PROPERTY_TYPES.RICH_TEXT ? (
                    <Textarea
                      value={value || ''}
                      onChange={(e) => handleFieldChange(propertyKey, e.target.value)}
                      placeholder="Add text..."
                      className="min-h-[80px]"
                      onBlur={handleSave}
                    />
                  ) : property.type === NOTION_PROPERTY_TYPES.SELECT ? (
                    <Select
                      value={value || 'none'}
                      onValueChange={(newValue) => {
                        const actualValue = newValue === 'none' ? '' : newValue;
                        handleFieldChange(propertyKey, actualValue);
                        handleSave();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No selection</SelectItem>
                        {/* Add options based on your select property configuration */}
                      </SelectContent>
                    </Select>
                  ) : property.type === NOTION_PROPERTY_TYPES.MULTI_SELECT ? (
                    <div className="space-y-2">
                      <NotionBadgeList
                        options={value || []}
                        containerMaxWidth="200px"
                        maxWidth="100px"
                      />
                      <Input
                        placeholder="Add tags..."
                        value={newTagInputs[propertyKey] || ''}
                        onChange={(e) =>
                          setNewTagInputs((prev) => ({ ...prev, [propertyKey]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTagInputs[propertyKey]) {
                            const newTags = [...(value || []), newTagInputs[propertyKey]];
                            handleMultiSelectChange(propertyKey, newTags);
                            setNewTagInputs((prev) => ({ ...prev, [propertyKey]: '' }));
                            handleSave();
                          }
                        }}
                      />
                    </div>
                  ) : property.type === NOTION_PROPERTY_TYPES.DATE ? (
                    <Input
                      type="date"
                      value={value || ''}
                      onChange={(e) => handleFieldChange(propertyKey, e.target.value)}
                      onBlur={handleSave}
                    />
                  ) : property.type === NOTION_PROPERTY_TYPES.NUMBER ? (
                    <Input
                      type="number"
                      value={value || ''}
                      onChange={(e) => handleFieldChange(propertyKey, e.target.value)}
                      onBlur={handleSave}
                    />
                  ) : property.type === NOTION_PROPERTY_TYPES.CHECKBOX ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => {
                          handleFieldChange(propertyKey, e.target.checked);
                          handleSave();
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{property.name}</span>
                    </div>
                  ) : (
                    <Input
                      value={value || ''}
                      onChange={(e) => handleFieldChange(propertyKey, e.target.value)}
                      onBlur={handleSave}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Entry"
        description="Are you sure you want to delete this entry? This action cannot be undone."
        itemName={getEntryTitle()}
      />
    </>
  );
}
