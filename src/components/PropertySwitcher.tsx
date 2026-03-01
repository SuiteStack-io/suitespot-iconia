import { usePropertySafe } from '@/lib/propertyContext';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function PropertySwitcher() {
  const propertyContext = usePropertySafe();
  const [open, setOpen] = useState(false);

  if (!propertyContext) return null;

  const { properties, activeProperty, setActiveProperty, isLoading } = propertyContext;

  const activeProperties = properties.filter(p => p.is_active !== false);

  if (isLoading) return null;

  if (activeProperties.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[hsl(30,8%,25%)]">
        <Building2 className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs text-muted-foreground">No properties assigned. Contact your administrator.</span>
      </div>
    );
  }

  const formatLabel = (prop: { name: string; city: string }) =>
    `${prop.name} — ${prop.city}`;

  if (activeProperties.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-[hsl(30,8%,25%)]">
        <Building2 className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm text-white truncate">{formatLabel(activeProperties[0])}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md bg-[hsl(30,8%,25%)] hover:bg-[hsl(30,8%,30%)] transition-colors text-left"
        >
          <Building2 className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="text-sm text-white truncate flex-1">
            {activeProperty ? formatLabel(activeProperty) : 'Select property'}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-[hsl(30,15%,60%)] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 bg-[hsl(30,5%,18%)] border-[hsl(30,8%,30%)]"
        align="start"
        sideOffset={4}
      >
        {activeProperties.map(prop => {
          const isActive = activeProperty?.id === prop.id;
          return (
            <button
              key={prop.id}
              onClick={() => {
                setActiveProperty(prop);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'text-[hsl(30,15%,75%)] hover:bg-[hsl(30,8%,25%)] hover:text-white'
              )}
            >
              <Check
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="truncate">{formatLabel(prop)}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
