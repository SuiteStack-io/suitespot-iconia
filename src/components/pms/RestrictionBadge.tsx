import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface RestrictionBadgeProps {
  type: 'min_stay' | 'max_stay' | 'stop_sell' | 'cta' | 'ctd';
  value?: number;
  synced?: boolean;
}

const badgeConfig = {
  min_stay: {
    label: (v?: number) => `MS:${v ?? 1}`,
    tooltip: (v?: number) => `Min Stay: ${v ?? 1} night(s)`,
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  max_stay: {
    label: (v?: number) => `MX:${v ?? '∞'}`,
    tooltip: (v?: number) => `Max Stay: ${v ?? 'No limit'} night(s)`,
    className: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  stop_sell: {
    label: () => '🛑',
    tooltip: () => 'Stop Sell — No bookings allowed',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  cta: {
    label: () => '⛔A',
    tooltip: () => 'Closed to Arrival — No check-ins on this date',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  ctd: {
    label: () => '⛔D',
    tooltip: () => 'Closed to Departure — No check-outs on this date',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
};

export function RestrictionBadge({ type, value, synced }: RestrictionBadgeProps) {
  const config = badgeConfig[type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center px-1 py-0.5 text-[10px] font-medium rounded border leading-none ${config.className} ${synced === false ? 'opacity-60 ring-1 ring-orange-400' : ''}`}
          >
            {config.label(value)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{config.tooltip(value)}</p>
          {synced === false && <p className="text-orange-500 mt-1">Pending sync to Channex</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
