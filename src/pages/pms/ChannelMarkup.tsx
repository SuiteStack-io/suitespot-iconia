import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, RefreshCw, Calculator, Percent, Check, ChevronsUpDown } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChannelMarkup {
  id: string;
  channel_name: string;
  channel_id: string | null;
  markup_percentage: number;
  is_active: boolean;
  created_at: string;
}

interface DerivedMapping {
  id: string;
  base_rate_plan_id: string;
  channel_markup_id: string;
  channex_base_rate_plan_id: string;
  channex_derived_rate_plan_id: string;
  channel_name: string;
  markup_percentage: number;
}

interface RatePlan {
  id: string;
  name: string;
  room_type: string | null;
}

interface ChannexMapping {
  local_id: string;
  channex_id: string;
  entity_type: string;
  sync_status: string;
}

const OTA_CHANNELS = [
  { label: 'Booking.com', value: 'booking_com' },
  { label: 'Expedia', value: 'expedia' },
  { label: 'Airbnb', value: 'airbnb' },
  { label: 'Agoda', value: 'agoda' },
  { label: 'Hotels.com', value: 'hotels_com' },
  { label: 'TripAdvisor', value: 'tripadvisor' },
  { label: 'Vrbo', value: 'vrbo' },
  { label: 'Hostelworld', value: 'hostelworld' },
  { label: 'Trip.com', value: 'trip_com' },
  { label: 'Hotelbeds', value: 'hotelbeds' },
  { label: 'HRS', value: 'hrs' },
  { label: 'Despegar', value: 'despegar' },
  { label: 'Rakuten Travel', value: 'rakuten_travel' },
  { label: 'MakeMyTrip', value: 'makemytrip' },
  { label: 'Traveloka', value: 'traveloka' },
  { label: 'Webjet', value: 'webjet' },
  { label: 'Lastminute.com', value: 'lastminute_com' },
  { label: 'Laterooms', value: 'laterooms' },
  { label: 'CTrip', value: 'ctrip' },
  { label: 'Wotif', value: 'wotif' },
];

const ChannelMarkupPage = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelMarkup[]>([]);
  const [derivedMappings, setDerivedMappings] = useState<DerivedMapping[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [channexMappings, setChannexMappings] = useState<ChannexMapping[]>([]);
  
  // Add channel form
  const [selectedChannel, setSelectedChannel] = useState<{ label: string; value: string } | null>(null);
  const [channelPopoverOpen, setChannelPopoverOpen] = useState(false);
  const [newMarkupPct, setNewMarkupPct] = useState('18');
  const [addingChannel, setAddingChannel] = useState(false);
  
  // Calculator
  const [calcBaseRate, setCalcBaseRate] = useState('100');
  const [calcMarkup, setCalcMarkup] = useState('18');
  const [calcCommission, setCalcCommission] = useState('15');
  
  // Actions
  const [creatingDerived, setCreatingDerived] = useState<string | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [channelsRes, mappingsRes, plansRes, channexRes] = await Promise.all([
        supabase.from('channel_markup_settings').select('*').order('created_at'),
        supabase.from('derived_rate_plan_mappings').select('*'),
        supabase.from('rate_plans').select('id, name, room_type').eq('is_active', true),
        supabase.from('channex_mappings').select('local_id, channex_id, entity_type, sync_status').in('entity_type', ['rate_plan', 'derived_rate_plan']),
      ]);

      setChannels((channelsRes.data as ChannelMarkup[]) || []);
      setDerivedMappings((mappingsRes.data as DerivedMapping[]) || []);
      setRatePlans((plansRes.data as RatePlan[]) || []);
      setChannexMappings((channexRes.data as ChannexMapping[]) || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addChannel = async () => {
    if (!selectedChannel || !newMarkupPct) return;
    setAddingChannel(true);
    try {
      const { data: inserted, error } = await supabase.from('channel_markup_settings').insert({
        channel_name: selectedChannel.label,
        channel_id: selectedChannel.value,
        markup_percentage: parseFloat(newMarkupPct),
        is_active: true,
      }).select().single();
      if (error) throw error;
      toast.success(`${selectedChannel.label} channel added — creating derived plans...`);
      setSelectedChannel(null);
      setNewMarkupPct('18');
      // Refresh data first so createDerivedPlansForChannel has latest state
      await fetchData();
      // Auto-create derived plans for all synced base rate plans
      if (inserted) {
        await createDerivedPlansForChannel(inserted.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add channel');
    } finally {
      setAddingChannel(false);
    }
  };

  const updateMarkup = async (channelId: string, newPct: number) => {
    try {
      const { error } = await supabase
        .from('channel_markup_settings')
        .update({ markup_percentage: newPct })
        .eq('id', channelId);
      if (error) throw error;
      toast.success('Markup updated — recreating derived plans...');
      // Delete existing derived plans and recreate with new percentage
      await deleteAllDerivedForChannel(channelId);
      await fetchData();
      await createDerivedPlansForChannel(channelId);
    } catch {
      toast.error('Failed to update markup');
    }
  };

  const createDerivedPlansForChannel = async (channelId: string) => {
    setCreatingDerived(channelId);
    const syncedBasePlans = ratePlans.filter(rp =>
      channexMappings.some(m => m.local_id === rp.id && m.entity_type === 'rate_plan' && m.sync_status === 'synced')
    );

    if (syncedBasePlans.length === 0) {
      toast.error('No base rate plans are synced to Channex');
      setCreatingDerived(null);
      return;
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const plan of syncedBasePlans) {
      // Check if derived already exists
      const exists = derivedMappings.some(
        dm => dm.base_rate_plan_id === plan.id && dm.channel_markup_id === channelId
      );
      if (exists) { skipped++; continue; }

      try {
        const { data, error } = await supabase.functions.invoke('channex-create-derived-rate-plan', {
          body: { base_rate_plan_id: plan.id, channel_markup_id: channelId },
        });
        if (error) throw error;
        if (data?.success) { created++; } else { errors++; console.error(data?.error); }
      } catch (err) {
        errors++;
        console.error('Failed to create derived plan for', plan.name, err);
      }
    }

    toast.success(`Created ${created} derived plans${skipped ? `, ${skipped} skipped` : ''}${errors ? `, ${errors} errors` : ''}`);
    setCreatingDerived(null);
    fetchData();
  };

  const deleteAllDerivedForChannel = async (channelId: string) => {
    const channelDerived = derivedMappings.filter(dm => dm.channel_markup_id === channelId);
    if (channelDerived.length === 0) {
      toast.info('No derived plans to delete');
      return;
    }

    let deleted = 0;
    for (const dm of channelDerived) {
      try {
        const { data, error } = await supabase.functions.invoke('channex-delete-derived-rate-plan', {
          body: { derived_mapping_id: dm.id },
        });
        if (error) throw error;
        if (data?.success) deleted++;
      } catch (err) {
        console.error('Failed to delete derived plan', dm.id, err);
      }
    }
    toast.success(`Deleted ${deleted} derived plans`);
    fetchData();
  };

  const confirmDeleteChannel = async () => {
    if (!deletingChannel) return;
    // Delete all derived plans for this channel first
    await deleteAllDerivedForChannel(deletingChannel);
    // Then delete the channel setting
    const { error } = await supabase.from('channel_markup_settings').delete().eq('id', deletingChannel);
    if (error) {
      toast.error('Failed to delete channel');
    } else {
      toast.success('Channel removed');
    }
    setDeleteDialogOpen(false);
    setDeletingChannel(null);
    fetchData();
  };

  // Calculator values
  const baseRate = parseFloat(calcBaseRate) || 0;
  const markup = parseFloat(calcMarkup) || 0;
  const commission = parseFloat(calcCommission) || 0;
  const sellRate = baseRate * (1 + markup / 100);
  const netAfterCommission = sellRate * (1 - commission / 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <SlideMenu userRole={userRole} />
          <h1 className="text-lg font-semibold">Channel Markup</h1>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="PMS" currentPage="Channel Markup" />
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Live Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Rate Calculator
            </CardTitle>
            <CardDescription>Preview how markup affects your net revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-xs">Base Rate ($)</Label>
                <Input type="number" value={calcBaseRate} onChange={e => setCalcBaseRate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Markup (%)</Label>
                <Input type="number" value={calcMarkup} onChange={e => setCalcMarkup(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">OTA Commission (%)</Label>
                <Input type="number" value={calcCommission} onChange={e => setCalcCommission(e.target.value)} />
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
              <p>Base rate: <span className="font-semibold">${baseRate.toFixed(2)}</span>/night</p>
              <p>→ Sell rate to OTA: <span className="font-semibold text-primary">${sellRate.toFixed(2)}</span>/night (+{markup}%)</p>
              <p>→ After ~{commission}% commission: <span className="font-semibold text-green-600">${netAfterCommission.toFixed(2)}</span> net</p>
            </div>
          </CardContent>
        </Card>

        {/* Add Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel Markup Settings</CardTitle>
            <CardDescription>Set markup percentages for each OTA channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Channel Name</Label>
                <Popover open={channelPopoverOpen} onOpenChange={setChannelPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={channelPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedChannel ? selectedChannel.label : "Select channel..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Search channel..." />
                      <CommandList>
                        <CommandEmpty>No channel found.</CommandEmpty>
                        <CommandGroup>
                          {OTA_CHANNELS
                            .filter(ota => !channels.some(ch => ch.channel_id === ota.value || ch.channel_name === ota.label))
                            .map(ota => (
                              <CommandItem
                                key={ota.value}
                                value={ota.label}
                                onSelect={() => {
                                  setSelectedChannel(ota);
                                  setChannelPopoverOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedChannel?.value === ota.value ? "opacity-100" : "opacity-0")} />
                                {ota.label}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-28">
                <Label className="text-xs">Markup %</Label>
                <Input
                  type="number"
                  value={newMarkupPct}
                  onChange={e => setNewMarkupPct(e.target.value)}
                />
              </div>
              <Button onClick={addChannel} disabled={addingChannel || !selectedChannel} className="gap-2">
                {addingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Channel
              </Button>
            </div>

            {channels.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Markup</TableHead>
                    <TableHead>Derived Plans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map(ch => {
                    const derivedCount = derivedMappings.filter(dm => dm.channel_markup_id === ch.id).length;
                    return (
                      <TableRow key={ch.id}>
                        <TableCell className="font-medium">{ch.channel_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="w-20 h-8"
                              defaultValue={ch.markup_percentage}
                              onBlur={e => {
                                const val = parseFloat(e.target.value);
                                if (val !== ch.markup_percentage) updateMarkup(ch.id, val);
                              }}
                            />
                            <Percent className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{derivedCount} plans</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={creatingDerived === ch.id}
                              onClick={() => createDerivedPlansForChannel(ch.id)}
                              className="gap-1"
                            >
                              {creatingDerived === ch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Create
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setDeletingChannel(ch.id); setDeleteDialogOpen(true); }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Derived Rate Plans Table */}
        {derivedMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Derived Rate Plans</CardTitle>
              <CardDescription>Rate plans created in Channex with channel markup applied</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Base Plan</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Markup</TableHead>
                    <TableHead>Channex ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedMappings.map(dm => {
                    const basePlan = ratePlans.find(rp => rp.id === dm.base_rate_plan_id);
                    return (
                      <TableRow key={dm.id}>
                        <TableCell className="font-medium">{basePlan?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">{basePlan?.room_type || '—'}</TableCell>
                        <TableCell>{dm.channel_name}</TableCell>
                        <TableCell>+{dm.markup_percentage}%</TableCell>
                        <TableCell className="font-mono text-xs">{dm.channex_derived_rate_plan_id.slice(0, 12)}...</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all derived rate plans for this channel from Channex and remove the channel markup setting. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChannelMarkupPage;
