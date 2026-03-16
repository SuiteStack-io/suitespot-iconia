import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Loader2, X, Save, ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/usePropertyFilter';
import { Skeleton } from '@/components/ui/skeleton';

export interface PendingAvailability {
  id: string;
  roomTypeName: string;
  roomTypeUnitId: string;
  dateFrom: string;
  dateTo: string;
  availability: number;
  previousAvailability: number | null;
  addedAt: Date;
}

interface BulkAvailabilityEditorProps {
  pendingAvailability: PendingAvailability[];
  setPendingAvailability: React.Dispatch<React.SetStateAction<PendingAvailability[]>>;
}

interface RoomTypeOption {
  name: string;
  unitId: string; // first unit ID for channex mapping
}

export function BulkAvailabilityEditor({ pendingAvailability, setPendingAvailability }: BulkAvailabilityEditorProps) {
  const { toast } = useToast();
  const propertyId = usePropertyId();

  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [availability, setAvailability] = useState(0);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState('');
  const [syncError, setSyncError] = useState('');
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [currentAvailability, setCurrentAvailability] = useState<number | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch room types from units grouped by booking_com_name
  useEffect(() => {
    if (!propertyId) return;
    const fetchRoomTypes = async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, booking_com_name')
        .eq('property_id', propertyId)
        .not('booking_com_name', 'is', null)
        .order('booking_com_name');

      if (error) {
        console.error('Error fetching room types:', error);
        return;
      }

      // Group by booking_com_name, take first unit ID
      const grouped = new Map<string, string>();
      for (const unit of data || []) {
        if (unit.booking_com_name && !grouped.has(unit.booking_com_name)) {
          grouped.set(unit.booking_com_name, unit.id);
        }
      }

      setRoomTypes(
        Array.from(grouped.entries()).map(([name, unitId]) => ({ name, unitId }))
      );
    };
    fetchRoomTypes();
  }, [propertyId]);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingAvailability.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved availability changes that will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingAvailability.length]);

  // Auto-fetch current availability when room type or date changes
  useEffect(() => {
    if (!selectedRoomType || !dateFrom || !propertyId) {
      setCurrentAvailability(null);
      return;
    }

    let cancelled = false;
    const fetchCurrent = async () => {
      setIsLoadingAvailability(true);
      try {
        const { data } = await supabase
          .from('units')
          .select('id')
          .eq('property_id', propertyId)
          .eq('booking_com_name', selectedRoomType)
          .neq('status', 'maintenance');

        if (cancelled) return;
        const count = data?.length || 0;
        setCurrentAvailability(count);
        setAvailability(count);
      } catch {
        if (!cancelled) setCurrentAvailability(null);
      } finally {
        if (!cancelled) setIsLoadingAvailability(false);
      }
    };
    fetchCurrent();
    return () => { cancelled = true; };
  }, [selectedRoomType, dateFrom, propertyId]);

  const selectedRoomTypeOption = useMemo(
    () => roomTypes.find(r => r.name === selectedRoomType),
    [roomTypes, selectedRoomType]
  );

  const resetForm = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setAvailability(0);
    setCurrentAvailability(null);
  };

  const handleApply = () => {
    if (!selectedRoomType || !selectedRoomTypeOption) {
      toast({ title: 'Validation Error', description: 'Please select a room type', variant: 'destructive' });
      return;
    }
    if (!dateFrom) {
      toast({ title: 'Validation Error', description: 'Please select a start date', variant: 'destructive' });
      return;
    }
    if (!dateTo) {
      toast({ title: 'Validation Error', description: 'Please select an end date', variant: 'destructive' });
      return;
    }
    if (dateFrom < today) {
      toast({ title: 'Validation Error', description: 'Start date must be today or future', variant: 'destructive' });
      return;
    }
    if (dateTo < dateFrom) {
      toast({ title: 'Validation Error', description: 'End date must be on or after start date', variant: 'destructive' });
      return;
    }
    if (availability < 0) {
      toast({ title: 'Validation Error', description: 'Availability must be 0 or more', variant: 'destructive' });
      return;
    }

    const newPending: PendingAvailability = {
      id: crypto.randomUUID(),
      roomTypeName: selectedRoomType,
      roomTypeUnitId: selectedRoomTypeOption.unitId,
      dateFrom: format(dateFrom, 'yyyy-MM-dd'),
      dateTo: format(dateTo, 'yyyy-MM-dd'),
      availability,
      previousAvailability: currentAvailability,
      addedAt: new Date(),
    };

    setPendingAvailability(prev => [...prev, newPending]);
    resetForm();
    toast({ title: 'Added', description: 'Availability override added to pending changes' });
  };

  const handleRemovePending = (id: string) => {
    setPendingAvailability(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveAllChanges = async () => {
    if (pendingAvailability.length === 0 || !propertyId) return;
    setSyncStatus('syncing');
    setSyncProgress(0);
    setSyncStep('Pushing availability...');
    setSyncError('');

    const progressPromise = animateProgress(0, 45, 2000);

    try {
      const updates = pendingAvailability.map(p => ({
        property_id: propertyId,
        room_type_id: p.roomTypeUnitId,
        date_from: p.dateFrom,
        date_to: p.dateTo,
        availability: p.availability,
      }));

      const { data, error } = await supabase.functions.invoke('channex-push-availability', {
        body: { updates },
      });

      await progressPromise;

      if (error) throw error;

      if (data?.success === false) {
        setSyncStatus('error');
        setSyncError(data.error || data.message || 'Failed to push availability to Channex');
        setSyncProgress(45);
        toast({ title: 'Sync Failed', description: data.error || data.message || 'Failed to push availability to Channex', variant: 'destructive' });
        return;
      }

      setSyncStep('Pushing rates & restrictions...');
      await animateProgress(50, 85, 800);

      setSyncStep('Finalizing...');
      await animateProgress(90, 100, 400);

      setSyncStatus('success');
      setSyncProgress(100);
      setSyncStep('Sync complete');

      setPendingAvailability([]);
      toast({ title: 'Success', description: `Availability synced to Channex (${updates.length} update${updates.length > 1 ? 's' : ''})` });

      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress(0);
        setSyncStep('');
      }, 2000);
    } catch (err: any) {
      await progressPromise.catch(() => {});
      console.error('Error saving availability:', err);
      let errorMessage = 'Failed to save availability';
      if (err.context?.body) {
        try {
          const body = JSON.parse(err.context.body);
          if (body.error) errorMessage = body.error;
        } catch { /* ignore parse errors */ }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setSyncStatus('error');
      setSyncError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const isSyncing = syncStatus === 'syncing';

  const animateProgress = (from: number, to: number, durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      const steps = Math.max(1, Math.floor(durationMs / 80));
      const increment = (to - from) / steps;
      let current = from;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        current = Math.min(to, from + increment * step);
        setSyncProgress(Math.round(current));
        if (step >= steps) {
          clearInterval(interval);
          resolve();
        }
      }, 80);
    });
  };

  const handleFullSync = async () => {
    if (!propertyId) return;
    setSyncStatus('syncing');
    setSyncProgress(0);
    setSyncStep('Pushing availability...');
    setSyncError('');

    // Start animating to 45% while the request runs
    const progressPromise = animateProgress(0, 45, 2000);

    try {
      const { data, error } = await supabase.functions.invoke('channex-full-sync', {
        body: { propertyId },
      });

      // Wait for initial animation to finish
      await progressPromise;

      if (error) throw error;
      if (data?.success === false) {
        setSyncStatus('error');
        setSyncError(data.error || 'Failed to sync');
        setSyncProgress(45);
        toast({ title: 'Sync Failed', description: data.error || 'Failed to sync', variant: 'destructive' });
        return;
      }

      // Step 2: rates & restrictions
      setSyncStep('Pushing rates & restrictions...');
      await animateProgress(50, 85, 800);

      // Step 3: finalizing
      setSyncStep('Finalizing...');
      await animateProgress(90, 100, 400);

      setSyncStatus('success');
      setSyncProgress(100);
      setSyncStep('Sync complete');

      const roomTypeCount = data?.results?.length || 0;
      toast({ title: 'Success', description: `Availability synced to Channex (${roomTypeCount} room type${roomTypeCount !== 1 ? 's' : ''} pushed)` });

      // Fade out after 2s
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress(0);
        setSyncStep('');
      }, 2000);
    } catch (err: any) {
      await progressPromise.catch(() => {});
      setSyncStatus('error');
      setSyncError(err.message || 'Failed to sync to Channex');
      toast({ title: 'Sync Error', description: err.message || 'Failed to sync to Channex', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sync to Channex button + progress */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleFullSync} disabled={isSyncing}>
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync to Channex"}
          </Button>
        </div>
        {syncStatus !== 'idle' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{syncStep}</span>
              <span>{syncProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  syncStatus === 'error' ? 'bg-destructive' :
                  syncStatus === 'success' ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${syncProgress}%` }}
              />
            </div>
            {syncStatus === 'error' && (
              <p className="text-xs text-destructive">{syncError}</p>
            )}
          </div>
        )}
      </div>
      {/* Editor Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Availability Editor</CardTitle>
          <CardDescription>Set availability overrides for specific date ranges and sync to Channex</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Room Type */}
          <div className="space-y-2">
            <Label>Room Type</Label>
            <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
              <SelectTrigger>
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map(rt => (
                  <SelectItem key={rt.name} value={rt.name}>
                    {rt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      setDateFrom(d);
                      if (d && (!dateTo || dateTo < d)) setDateTo(d);
                      setDateFromOpen(false);
                    }}
                    disabled={(date) => date < today}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      setDateTo(d);
                      setDateToOpen(false);
                    }}
                    disabled={(date) => date < (dateFrom || today)}
                    defaultMonth={dateFrom}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Available Rooms */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Available Rooms</Label>
              {isLoadingAvailability ? (
                <Skeleton className="h-4 w-24" />
              ) : currentAvailability !== null ? (
                <span className="text-sm text-muted-foreground">
                  Current: {currentAvailability} room{currentAvailability !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={availability}
                onChange={(e) => setAvailability(parseInt(e.target.value) || 0)}
                className="w-24 h-9 text-right"
              />
              <span className="text-sm text-muted-foreground">rooms</span>
            </div>
            {currentAvailability !== null && availability !== currentAvailability && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">{currentAvailability}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={availability < currentAvailability ? 'text-orange-600' : 'text-green-600'}>
                  {availability}
                </span>
                <span className="text-muted-foreground">
                  ({availability > currentAvailability ? '+' : ''}{availability - currentAvailability})
                </span>
              </div>
            )}
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full sm:w-auto">
            Apply Availability
          </Button>
        </CardContent>
      </Card>

      {/* Pending Changes Card */}
      {pendingAvailability.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Pending Changes</CardTitle>
              <CardDescription>Review before syncing to Channex</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingAvailability([])}
                disabled={isSyncing}
              >
                Discard All
              </Button>
              <Button onClick={handleSaveAllChanges} disabled={isSyncing} size="sm">
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes ({pendingAvailability.length})
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingAvailability.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div className="space-y-1">
                  <div className="font-medium text-sm">{p.roomTypeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(p.dateFrom + 'T00:00:00'), 'MMM d, yyyy')}
                    {p.dateFrom !== p.dateTo && ` → ${format(new Date(p.dateTo + 'T00:00:00'), 'MMM d, yyyy')}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Availability</Badge>
                    <span className="text-xs text-muted-foreground">
                      {p.previousAvailability !== null ? p.previousAvailability : '?'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn("text-xs font-medium", 
                      p.previousAvailability !== null && p.availability < p.previousAvailability ? 'text-orange-600' : 'text-green-600'
                    )}>
                      {p.availability}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePending(p.id)}
                  className="h-8 w-8 shrink-0"
                  disabled={isSyncing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Progress bar for Save Changes */}
            {syncStatus !== 'idle' && (
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{syncStep}</span>
                  <span>{syncProgress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      syncStatus === 'error' ? 'bg-destructive' :
                      syncStatus === 'success' ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
                {syncStatus === 'error' && (
                  <p className="text-xs text-destructive">{syncError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
