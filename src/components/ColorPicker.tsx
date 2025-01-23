import * as Popover from '@radix-ui/react-popover';
import { Brush, Plus } from 'lucide-react';

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  const colors = [
    '#22c55e', // green
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#f97316', // orange
    '#eab308', // yellow
  ];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Brush className="w-4 h-4 text-slate-500" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="bg-white dark:bg-slate-900 p-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800" sideOffset={5} align="center">
          <div className="flex gap-2">
            {colors.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full ${
                  currentColor === color ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => onColorChange(color)}
              />
            ))}
            <div className="relative">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => onColorChange(e.target.value)}
                className="w-6 h-6 rounded-full appearance-none cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:rounded-full"
              />
              <Plus className="w-2.5 h-2.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
} 