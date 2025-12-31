'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Official Google Calendar event colors - matching the exact palette shown in Google Calendar UI
// Arranged in the same order as displayed: 2 rows of 6 colors each
// Top row: Red, Light Coral, Orange, Yellow, Mint Green, Dark Green
// Bottom row: Sky Blue, Royal Blue, Lavender, Purple, Dark Gray, Blue
const GOOGLE_CALENDAR_COLORS = [
  { id: '11', name: 'Red', hex: '#dc2127' },           // Top row, 1st - Red (selected in image)
  { id: '4', name: 'Flamingo', hex: '#ff887c' },       // Top row, 2nd - Light Coral/Salmon Pink
  { id: '6', name: 'Tangerine', hex: '#ffb878' },      // Top row, 3rd - Orange
  { id: '5', name: 'Banana', hex: '#fbd75b' },         // Top row, 4th - Yellow
  { id: '2', name: 'Sage', hex: '#7ae7bf' },           // Top row, 5th - Mint Green/Light Green
  { id: '10', name: 'Basil', hex: '#51b749' },         // Top row, 6th - Dark Green
  { id: '7', name: 'Peacock', hex: '#46d6db' },        // Bottom row, 1st - Sky Blue/Light Blue
  { id: '9', name: 'Blueberry', hex: '#5484ed' },      // Bottom row, 2nd - Royal Blue/Dark Blue
  { id: '1', name: 'Lavender', hex: '#a4bdfc' },       // Bottom row, 3rd - Lavender/Light Purple
  { id: '3', name: 'Grape', hex: '#dbadff' },          // Bottom row, 4th - Purple
  { id: '8', name: 'Graphite', hex: '#e1e1e1' },       // Bottom row, 5th - Dark Gray
  { id: '12', name: 'Blue', hex: '#4285f4' },          // Bottom row, 6th - Medium Blue (Google default)
];

interface EventColorMenuProps {
  event: { id: string; color?: string };
  calendarColor?: string; // The default calendar color
  onColorChange: (color: string | null) => void; // null means use calendar default
  children: React.ReactNode;
}

export function EventColorMenu({ event, calendarColor, onColorChange, children }: EventColorMenuProps) {
  const [open, setOpen] = React.useState(true);
  const [showCustomPicker, setShowCustomPicker] = React.useState(false);
  const [customColor, setCustomColor] = React.useState('#000000');
  const currentColor = event.color || calendarColor || '#4285f4';
  const defaultCalendarColor = calendarColor || '#4285f4';

  const handleColorSelect = (color: string | null) => {
    onColorChange(color);
    setOpen(false);
  };

  const handleCustomColorSelect = () => {
    handleColorSelect(customColor);
  };

  React.useEffect(() => {
    // Auto-open when component mounts
    setOpen(true);
  }, []);

  // Check if current color is a custom color (not in predefined list and not calendar default)
  const isCustomColor = React.useMemo(() => {
    const normalizedCurrent = currentColor.toLowerCase();
    const isPredefined = GOOGLE_CALENDAR_COLORS.some(
      (c) => c.hex.toLowerCase() === normalizedCurrent
    );
    const isCalendarDefault = normalizedCurrent === defaultCalendarColor.toLowerCase();
    return !isPredefined && !isCalendarDefault;
  }, [currentColor, defaultCalendarColor]);

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger asChild>
        {children}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          className={cn(
            'z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          align="start"
          sideOffset={5}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Change Color
          </div>
          <div className="grid grid-cols-4 gap-1 p-1">
            {GOOGLE_CALENDAR_COLORS.map((color) => {
              const isSelected = currentColor.toLowerCase() === color.hex.toLowerCase();
              return (
                <DropdownMenuPrimitive.Item
                  key={color.id}
                  className={cn(
                    'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm outline-none',
                    'focus:bg-accent focus:text-accent-foreground',
                    'hover:bg-accent hover:text-accent-foreground',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                  )}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleColorSelect(color.hex);
                  }}
                >
                  <div
                    className="h-6 w-6 rounded-sm border-2 border-border"
                    style={{ backgroundColor: color.hex }}
                  />
                  {isSelected && (
                    <Check className="absolute h-4 w-4 text-foreground" />
                  )}
                </DropdownMenuPrimitive.Item>
              );
            })}
          </div>
          
          {/* Custom Color Picker */}
          <div className="border-t mt-1 pt-1">
            {!showCustomPicker ? (
              <DropdownMenuPrimitive.Item
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded-sm outline-none px-2 py-1.5',
                  'focus:bg-accent focus:text-accent-foreground',
                  'hover:bg-accent hover:text-accent-foreground',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  setShowCustomPicker(true);
                  if (isCustomColor) {
                    setCustomColor(currentColor);
                  }
                }}
              >
                <Palette className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">
                  Custom Color
                </span>
                {isCustomColor && (
                  <div
                    className="h-4 w-4 rounded-sm border border-border flex-shrink-0"
                    style={{ backgroundColor: currentColor }}
                  />
                )}
              </DropdownMenuPrimitive.Item>
            ) : (
              <div className="px-2 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-8 w-16 cursor-pointer rounded border border-input"
                  />
                  <Input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                        setCustomColor(value);
                      }
                    }}
                    placeholder="#000000"
                    className="h-8 flex-1 text-xs"
                  />
                </div>
                <div className="flex gap-1">
                  <DropdownMenuPrimitive.Item
                    className={cn(
                      'flex-1 cursor-pointer items-center justify-center rounded-sm outline-none px-2 py-1 text-xs',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                    )}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleCustomColorSelect();
                    }}
                  >
                    Apply
                  </DropdownMenuPrimitive.Item>
                  <DropdownMenuPrimitive.Item
                    className={cn(
                      'flex-1 cursor-pointer items-center justify-center rounded-sm outline-none px-2 py-1 text-xs',
                      'bg-secondary text-secondary-foreground hover:bg-secondary/90',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                    )}
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowCustomPicker(false);
                    }}
                  >
                    Cancel
                  </DropdownMenuPrimitive.Item>
                </div>
              </div>
            )}
          </div>

          {/* Calendar default color as last option */}
          <div className="border-t mt-1">
            <DropdownMenuPrimitive.Item
              className={cn(
                'relative flex cursor-pointer items-center gap-2 rounded-sm outline-none px-2 py-1.5',
                'focus:bg-accent focus:text-accent-foreground',
                'hover:bg-accent hover:text-accent-foreground',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
              )}
              onSelect={(e) => {
                e.preventDefault();
                handleColorSelect(null); // null means use calendar default
              }}
            >
              <div
                className="h-6 w-6 rounded-sm border-2 border-border flex-shrink-0"
                style={{ backgroundColor: defaultCalendarColor }}
              />
              <span className="text-xs text-muted-foreground flex-1">
                Calendar Default
              </span>
              {(!event.color || currentColor.toLowerCase() === defaultCalendarColor.toLowerCase()) && (
                <Check className="h-4 w-4 text-foreground flex-shrink-0" />
              )}
            </DropdownMenuPrimitive.Item>
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
