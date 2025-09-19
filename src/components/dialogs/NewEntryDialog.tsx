'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { useDatabase } from '@/hooks/useDatabase';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { User, Clock, Tag, ArrowUpRight, List, Star, Plus, Calendar } from 'lucide-react';
import { NOTION_PROPERTY_TYPES } from '@/constants/notion-properties';
import { cacheUtils } from '@/lib/cache-utils';

interface NewEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  databaseId: string;
  onSuccess?: () => void;
}

interface FormData {
  [key: string]: any;
}

export function NewEntryDialog({ isOpen, onClose, databaseId, onSuccess }: NewEntryDialogProps) {
  const { user } = useUser();
  const { data: database, isLoading, error } = useDatabase(databaseId);
  const [formData, setFormData] = React.useState<FormData>({});
  const [multiSelectValues, setMultiSelectValues] = React.useState<Record<string, string[]>>({});
  const [newTagInputs, setNewTagInputs] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showMoreProperties, setShowMoreProperties] = React.useState(false);
  const [openDropdowns, setOpenDropdowns] = React.useState<Record<string, boolean>>({});

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdowns({});
    };

    if (Object.values(openDropdowns).some(Boolean)) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdowns]);

  const getPropertyIcon = (propertyType: string) => {
    switch (propertyType) {
      case NOTION_PROPERTY_TYPES.PEOPLE:
        return <User className="w-4 h-4" />;
      case NOTION_PROPERTY_TYPES.STATUS:
        return <Star className="w-4 h-4" />;
      case NOTION_PROPERTY_TYPES.DATE:
        return <Calendar className="w-4 h-4" />;
      case NOTION_PROPERTY_TYPES.SELECT:
        return <Clock className="w-4 h-4" />;
      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        return <List className="w-4 h-4" />;
      case NOTION_PROPERTY_TYPES.TITLE:
        return <ArrowUpRight className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const handleInputChange = (propertyKey: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [propertyKey]: value,
    }));
  };

  const handleMultiSelectAdd = (propertyKey: string, value: string) => {
    if (!value.trim()) return;

    setMultiSelectValues((prev) => ({
      ...prev,
      [propertyKey]: [...(prev[propertyKey] || []), value.trim()],
    }));
    setNewTagInputs((prev) => ({
      ...prev,
      [propertyKey]: '',
    }));
  };

  const handleMultiSelectRemove = (propertyKey: string, valueToRemove: string) => {
    setMultiSelectValues((prev) => ({
      ...prev,
      [propertyKey]: (prev[propertyKey] || []).filter((v) => v !== valueToRemove),
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Prepare the properties object for Notion API
      const notionProperties: Record<string, any> = {};

      Object.entries(database?.properties || {}).forEach(([key, property]) => {
        const value = formData[key];
        if (value === undefined || value === '') return;

        switch (property.type) {
          case NOTION_PROPERTY_TYPES.TITLE:
            notionProperties[key] = {
              title: [{ text: { content: value } }],
            };
            break;
          case NOTION_PROPERTY_TYPES.RICH_TEXT:
            notionProperties[key] = {
              rich_text: [{ text: { content: value } }],
            };
            break;
          case NOTION_PROPERTY_TYPES.NUMBER:
            notionProperties[key] = {
              number: parseFloat(value) || 0,
            };
            break;
          case NOTION_PROPERTY_TYPES.SELECT:
            notionProperties[key] = {
              select: { name: value },
            };
            break;
          case NOTION_PROPERTY_TYPES.STATUS:
            notionProperties[key] = {
              status: { name: value },
            };
            break;
          case NOTION_PROPERTY_TYPES.DATE:
            notionProperties[key] = {
              date: { start: value },
            };
            break;
          case NOTION_PROPERTY_TYPES.MULTI_SELECT:
            const tags = multiSelectValues[key] || [];
            if (tags.length > 0) {
              notionProperties[key] = {
                multi_select: tags.map((tag) => ({ name: tag })),
              };
            }
            break;
          case NOTION_PROPERTY_TYPES.CHECKBOX:
            notionProperties[key] = {
              checkbox: Boolean(value),
            };
            break;
        }
      });

      const response = await fetch(`/api/notion/database/${databaseId}/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: notionProperties,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create entry');
      }

      // Invalidate cache to refresh the UI
      cacheUtils.invalidateDatabasePages(databaseId);

      // Reset form and close dialog
      setFormData({});
      setMultiSelectValues({});
      setNewTagInputs({});
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating entry:', error);
      alert(error instanceof Error ? error.message : 'Failed to create entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPropertyField = (propertyKey: string, property: any) => {
    const value = formData[propertyKey] || '';
    const isRequired = property.type === NOTION_PROPERTY_TYPES.TITLE;

    // Skip formula properties as they are read-only
    if (property.type === 'formula') {
      return null;
    }

    switch (property.type) {
      case NOTION_PROPERTY_TYPES.TITLE:
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 mb-3">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name} {isRequired && <span className="text-destructive">*</span>}
              </Label>
            </div>
            <Input
              id={propertyKey}
              value={value}
              onChange={(e) => handleInputChange(propertyKey, e.target.value)}
              placeholder={`Enter ${property.name.toLowerCase()}...`}
              required={isRequired}
              className="text-2xl font-semibold border-0 shadow-none focus:ring-0 bg-transparent px-0 placeholder:text-muted-foreground/50"
            />
          </div>
        );

      case NOTION_PROPERTY_TYPES.RICH_TEXT:
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <Textarea
              id={propertyKey}
              value={value}
              onChange={(e) => handleInputChange(propertyKey, e.target.value)}
              placeholder={`Enter ${property.name.toLowerCase()}...`}
              rows={3}
              className="border-0 shadow-none focus:ring-0 bg-transparent px-0 resize-none"
            />
          </div>
        );

      case NOTION_PROPERTY_TYPES.NUMBER:
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <Input
              id={propertyKey}
              type="number"
              value={value}
              onChange={(e) => handleInputChange(propertyKey, e.target.value)}
              placeholder={`Enter ${property.name.toLowerCase()}...`}
              className="border-0 shadow-none focus:ring-0 bg-transparent px-0"
            />
          </div>
        );

      case NOTION_PROPERTY_TYPES.SELECT:
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <Select value={value} onValueChange={(val) => handleInputChange(propertyKey, val)}>
              <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent px-0">
                <SelectValue placeholder={`Select ${property.name.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                {property.select?.options?.map((option: any) => (
                  <SelectItem
                    key={option.id}
                    value={option.name}
                    className="flex items-center space-x-2"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        option.color === 'default'
                          ? 'bg-gray-400'
                          : option.color === 'gray'
                          ? 'bg-gray-500'
                          : option.color === 'brown'
                          ? 'bg-amber-700'
                          : option.color === 'orange'
                          ? 'bg-orange-500'
                          : option.color === 'yellow'
                          ? 'bg-yellow-500'
                          : option.color === 'green'
                          ? 'bg-green-500'
                          : option.color === 'blue'
                          ? 'bg-blue-500'
                          : option.color === 'purple'
                          ? 'bg-purple-500'
                          : option.color === 'pink'
                          ? 'bg-pink-500'
                          : option.color === 'red'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span>{option.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case NOTION_PROPERTY_TYPES.STATUS:
        const selectedStatus = property.status?.options?.find((opt: any) => opt.name === value);
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <Select value={value} onValueChange={(val) => handleInputChange(propertyKey, val)}>
              <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent px-0 h-auto py-1">
                <SelectValue placeholder={`Select ${property.name.toLowerCase()}...`}>
                  {value ? (
                    <Badge
                      variant="secondary"
                      className="shadow-none border-0"
                      style={{
                        backgroundColor:
                          selectedStatus?.color === 'default'
                            ? '#e5e7eb'
                            : selectedStatus?.color === 'gray'
                            ? '#6b7280'
                            : selectedStatus?.color === 'brown'
                            ? '#92400e'
                            : selectedStatus?.color === 'orange'
                            ? '#f97316'
                            : selectedStatus?.color === 'yellow'
                            ? '#eab308'
                            : selectedStatus?.color === 'green'
                            ? '#22c55e'
                            : selectedStatus?.color === 'blue'
                            ? '#3b82f6'
                            : selectedStatus?.color === 'purple'
                            ? '#a855f7'
                            : selectedStatus?.color === 'pink'
                            ? '#ec4899'
                            : selectedStatus?.color === 'red'
                            ? '#ef4444'
                            : '#e5e7eb',
                        color:
                          selectedStatus?.color === 'default' ||
                          selectedStatus?.color === 'gray' ||
                          selectedStatus?.color === 'brown' ||
                          selectedStatus?.color === 'red'
                            ? 'white'
                            : 'black',
                      }}
                    >
                      {value}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      Select {property.name.toLowerCase()}...
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="shadow-none border">
                {property.status?.groups?.map((group: any) => (
                  <div key={group.id}>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      {group.name}
                    </div>
                    {property.status.options
                      .filter((option: any) => group.option_ids.includes(option.id))
                      .map((option: any) => (
                        <SelectItem
                          key={option.id}
                          value={option.name}
                          className="flex items-center space-x-2"
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              option.color === 'default'
                                ? 'bg-gray-400'
                                : option.color === 'gray'
                                ? 'bg-gray-500'
                                : option.color === 'brown'
                                ? 'bg-amber-700'
                                : option.color === 'orange'
                                ? 'bg-orange-500'
                                : option.color === 'yellow'
                                ? 'bg-yellow-500'
                                : option.color === 'green'
                                ? 'bg-green-500'
                                : option.color === 'blue'
                                ? 'bg-blue-500'
                                : option.color === 'purple'
                                ? 'bg-purple-500'
                                : option.color === 'pink'
                                ? 'bg-pink-500'
                                : option.color === 'red'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                            }`}
                          />
                          <span>{option.name}</span>
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case NOTION_PROPERTY_TYPES.DATE:
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <div className="flex items-center">
              <Input
                id={propertyKey}
                type="date"
                value={value}
                onChange={(e) => handleInputChange(propertyKey, e.target.value)}
                className="border-0 shadow-none focus:ring-0 bg-transparent px-0 text-sm"
              />
              {value && (
                <span className="text-sm text-muted-foreground ml-2">
                  {new Date(value).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        );

      case NOTION_PROPERTY_TYPES.CHECKBOX:
        return (
          <div className="flex items-center space-x-2">
            <input
              id={propertyKey}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleInputChange(propertyKey, e.target.checked)}
              className="rounded border-border shadow-none"
            />
            <div className="flex items-center space-x-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium">
                {property.name}
              </Label>
            </div>
          </div>
        );

      case NOTION_PROPERTY_TYPES.MULTI_SELECT:
        const currentTags = multiSelectValues[propertyKey] || [];
        const newTagInput = newTagInputs[propertyKey] || '';
        const availableOptions = property.multi_select?.options || [];
        const filteredOptions = availableOptions.filter(
          (option: { name: string; color?: string }) =>
            option.name.toLowerCase().includes(newTagInput.toLowerCase()) &&
            !currentTags.includes(option.name)
        );

        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <div className="space-y-2">
              {/* Existing tags */}
              {currentTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {currentTags.map((tag, index) => {
                    // Find the option to get its color
                    const option = property.multi_select?.options?.find(
                      (opt: any) => opt.name === tag
                    );
                    return (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1 shadow-none"
                        style={{
                          backgroundColor:
                            option?.color === 'default'
                              ? '#e5e7eb'
                              : option?.color === 'gray'
                              ? '#6b7280'
                              : option?.color === 'brown'
                              ? '#92400e'
                              : option?.color === 'orange'
                              ? '#f97316'
                              : option?.color === 'yellow'
                              ? '#eab308'
                              : option?.color === 'green'
                              ? '#22c55e'
                              : option?.color === 'blue'
                              ? '#3b82f6'
                              : option?.color === 'purple'
                              ? '#a855f7'
                              : option?.color === 'pink'
                              ? '#ec4899'
                              : option?.color === 'red'
                              ? '#ef4444'
                              : '#e5e7eb',
                          color:
                            option?.color === 'default' ||
                            option?.color === 'gray' ||
                            option?.color === 'brown' ||
                            option?.color === 'red'
                              ? 'white'
                              : 'black',
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleMultiSelectRemove(propertyKey, tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Search input with dropdown */}
              <div className="relative">
                <Input
                  value={newTagInput}
                  onChange={(e) => {
                    setNewTagInputs((prev) => ({
                      ...prev,
                      [propertyKey]: e.target.value,
                    }));
                    setOpenDropdowns((prev) => ({
                      ...prev,
                      [propertyKey]: true,
                    }));
                  }}
                  onFocus={() => {
                    setOpenDropdowns((prev) => ({
                      ...prev,
                      [propertyKey]: true,
                    }));
                  }}
                  placeholder="Search for an option..."
                  className="border-0 shadow-none focus:ring-0 bg-transparent px-0 placeholder:text-muted-foreground/50"
                />

                {/* Options dropdown */}
                {openDropdowns[propertyKey] && newTagInput && filteredOptions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-none z-10 max-h-48 overflow-y-auto">
                    <div className="p-2 text-xs font-medium text-muted-foreground border-b">
                      Select an option or create one
                    </div>
                    {filteredOptions.map(
                      (option: { name: string; color?: string; id?: string }) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            handleMultiSelectAdd(propertyKey, option.name);
                            setNewTagInputs((prev) => ({
                              ...prev,
                              [propertyKey]: '',
                            }));
                            setOpenDropdowns((prev) => ({
                              ...prev,
                              [propertyKey]: false,
                            }));
                          }}
                          className="w-full flex items-center space-x-2 p-2 hover:bg-muted text-left"
                        >
                          <div
                            className={`w-2 h-2 rounded-full ${
                              option.color === 'default'
                                ? 'bg-gray-400'
                                : option.color === 'gray'
                                ? 'bg-gray-500'
                                : option.color === 'brown'
                                ? 'bg-amber-700'
                                : option.color === 'orange'
                                ? 'bg-orange-500'
                                : option.color === 'yellow'
                                ? 'bg-yellow-500'
                                : option.color === 'green'
                                ? 'bg-green-500'
                                : option.color === 'blue'
                                ? 'bg-blue-500'
                                : option.color === 'purple'
                                ? 'bg-purple-500'
                                : option.color === 'pink'
                                ? 'bg-pink-500'
                                : option.color === 'red'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-sm">{option.name}</span>
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* Create new option */}
                {openDropdowns[propertyKey] &&
                  newTagInput &&
                  !availableOptions.some(
                    (opt: { name: string; color?: string }) =>
                      opt.name.toLowerCase() === newTagInput.toLowerCase()
                  ) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-none z-10">
                      <button
                        onClick={() => {
                          handleMultiSelectAdd(propertyKey, newTagInput);
                          setNewTagInputs((prev) => ({
                            ...prev,
                            [propertyKey]: '',
                          }));
                          setOpenDropdowns((prev) => ({
                            ...prev,
                            [propertyKey]: false,
                          }));
                        }}
                        className="w-full flex items-center space-x-2 p-2 hover:bg-muted text-left"
                      >
                        <Plus className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Create "{newTagInput}"</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        );

      case NOTION_PROPERTY_TYPES.PEOPLE:
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-2">
              {getPropertyIcon(property.type)}
              <Label htmlFor={propertyKey} className="text-sm font-medium text-muted-foreground">
                {property.name}
              </Label>
            </div>
            <Input
              id={propertyKey}
              value={value}
              onChange={(e) => handleInputChange(propertyKey, e.target.value)}
              placeholder={`Enter ${property.name.toLowerCase()}...`}
              className="border-0 shadow-none focus:ring-0 bg-transparent px-0"
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] shadow-none border">
          <DialogHeader>
            <DialogTitle>New Entry</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !database) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] shadow-none border">
          <DialogHeader>
            <DialogTitle>New Entry</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-32">
            <div className="text-destructive">Error loading database: {error?.message}</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const propertyEntries = Object.entries(database.properties || {});

  // Sort properties: required fields first, then alphabetically
  const sortedProperties = propertyEntries.sort(([, a], [, b]) => {
    const aRequired = a.type === NOTION_PROPERTY_TYPES.TITLE;
    const bRequired = b.type === NOTION_PROPERTY_TYPES.TITLE;

    if (aRequired && !bRequired) return -1;
    if (!aRequired && bRequired) return 1;

    return a.name.localeCompare(b.name);
  });

  const visibleProperties = showMoreProperties ? sortedProperties : sortedProperties.slice(0, 6);
  const hiddenPropertiesCount = sortedProperties.length - 6;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto shadow-none border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">New Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {visibleProperties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No properties available for this database.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {visibleProperties.map(([key, property]) => (
                <div key={key} className="space-y-3">
                  {renderPropertyField(key, property)}
                </div>
              ))}

              {hiddenPropertiesCount > 0 && (
                <button
                  onClick={() => setShowMoreProperties(!showMoreProperties)}
                  className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground p-3 rounded-md hover:bg-muted transition-colors w-full justify-start"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    {showMoreProperties ? (
                      <div className="w-2 h-0.5 bg-current" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </div>
                  <span>
                    {showMoreProperties
                      ? `Hide ${hiddenPropertiesCount} properties`
                      : `Show ${hiddenPropertiesCount} more properties`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
