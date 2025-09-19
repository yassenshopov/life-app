import React from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';

interface PropertyVisibilityMenuProps {
  properties: Record<string, any>;
  visibleProperties: string[];
  onToggleProperty: (propertyKey: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function PropertyVisibilityMenu({
  properties,
  visibleProperties,
  onToggleProperty,
  onShowAll,
  onHideAll,
}: PropertyVisibilityMenuProps) {
  const propertyEntries = Object.entries(properties).sort(([, propA], [, propB]) => {
    // Always put title property first
    if (propA.type === 'title') return -1;
    if (propB.type === 'title') return 1;

    // Then sort alphabetically by property name
    return propA.name.localeCompare(propB.name);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <span className="sr-only">Property visibility options</span>
          <Eye className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show properties</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onShowAll} className="gap-2">
          <Eye className="h-4 w-4" />
          Show all
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onHideAll} className="gap-2">
          <EyeOff className="h-4 w-4" />
          Hide all
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {propertyEntries.map(([key, property]) => {
          const isVisible = visibleProperties.includes(key);
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onToggleProperty(key)}
              className="gap-2 cursor-pointer"
            >
              <Checkbox
                checked={isVisible}
                onChange={() => onToggleProperty(key)}
                className="pointer-events-none"
              />
              <span className="flex-1">{property.name || key}</span>
              {isVisible && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
