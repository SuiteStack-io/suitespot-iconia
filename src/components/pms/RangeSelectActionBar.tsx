import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

interface RangeSelectActionBarProps {
  selectionCount: number;
  prefillValue: number;
  onApply: (value: number) => void;
  onCancel: () => void;
  busy?: boolean;
  label?: string;
}

export const RangeSelectActionBar: React.FC<RangeSelectActionBarProps> = ({
  selectionCount,
  prefillValue,
  onApply,
  onCancel,
  busy = false,
  label = 'cells',
}) => {
  const [value, setValue] = useState<string>(String(Math.max(0, Math.round(prefillValue || 0))));

  useEffect(() => {
    setValue(String(Math.max(0, Math.round(prefillValue || 0))));
  }, [prefillValue, selectionCount]);

  if (selectionCount === 0) return null;

  const submit = () => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    onApply(num);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <Card className="pointer-events-auto shadow-lg border-2 border-primary/30 bg-background px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectionCount} {label} selected
        </span>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            else if (e.key === 'Escape') onCancel();
          }}
          className="w-28 h-9"
          autoFocus
          disabled={busy}
        />
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Applying…' : 'Apply'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" />
        </Button>
      </Card>
    </div>
  );
};

export default RangeSelectActionBar;
