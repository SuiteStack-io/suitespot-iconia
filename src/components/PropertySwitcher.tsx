import { usePropertySafe } from '@/lib/propertyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Star } from 'lucide-react';

export function PropertySwitcher() {
  const propertyContext = usePropertySafe();

  if (!propertyContext) return null;

  const { properties, activeProperty, setActiveProperty, isLoading } = propertyContext;

  if (isLoading || properties.length === 0) return null;

  if (properties.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        <span className="truncate">{properties[0].name}</span>
      </div>
    );
  }

  return (
    <Select
      value={activeProperty?.id || ''}
      onValueChange={(id) => {
        const prop = properties.find(p => p.id === id);
        if (prop) setActiveProperty(prop);
      }}
    >
      <SelectTrigger className="h-8 border-border bg-muted text-muted-foreground text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" />
          <SelectValue placeholder="Select property" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {properties.map(prop => (
          <SelectItem key={prop.id} value={prop.id}>
            <div className="flex items-center gap-2">
              {prop.is_default && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
              <span>{prop.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
