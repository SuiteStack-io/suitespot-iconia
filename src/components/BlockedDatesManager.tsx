import { useState, useEffect, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, eachDayOfInterval, differenceInDays, addDays, isAfter, isBefore, startOfDay, endOfMonth, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2, CalendarIcon, Filter, X, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
  unit_id: string | null;
  units?: {
    name: string;
    unit_number: string | null;
  } | null;
}

interface GroupedBlockedDates {
  key: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  unit_id: string | null;
  unitName: string;
  unitNumber: string | null;
  dateCount: number;
  ids: string[];
}

export const BlockedDatesManager = () => {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedBlockedDates | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editLoading, setEditLoading] = useState(false);
  
  // Filter state
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "future" | "thisMonth">("future");
  const [searchReason, setSearchReason] = useState("");
  
  // Bulk selection state
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBlockedDates();
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, unit_number")
        .eq("status", "available")
        .order("unit_number", { ascending: true });

      if (error) throw error;
      setUnits(data || []);
    } catch (error: any) {
      console.error("Error fetching units:", error);
      toast.error("Failed to fetch units");
    }
  };

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from("blocked_dates")
        .select(`
          *,
          units (
            name,
            unit_number
          )
        `)
        .order("blocked_date", { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error: any) {
      console.error("Error fetching blocked dates:", error);
      toast.error("Failed to fetch blocked dates");
    }
  };

  // Group consecutive blocked dates
  const groupedBlockedDates = useMemo((): GroupedBlockedDates[] => {
    if (blockedDates.length === 0) return [];

    const groups: GroupedBlockedDates[] = [];
    const sorted = [...blockedDates].sort((a, b) => 
      a.blocked_date.localeCompare(b.blocked_date) || 
      (a.unit_id || '').localeCompare(b.unit_id || '') ||
      (a.reason || '').localeCompare(b.reason || '')
    );

    let currentGroup: GroupedBlockedDates | null = null;

    for (const date of sorted) {
      const dateObj = parseISO(date.blocked_date);
      const unitKey = date.unit_id || 'all';
      const reasonKey = date.reason || '';

      if (
        currentGroup &&
        currentGroup.unit_id === date.unit_id &&
        currentGroup.reason === date.reason &&
        differenceInDays(dateObj, parseISO(currentGroup.endDate)) === 1
      ) {
        // Extend current group
        currentGroup.endDate = date.blocked_date;
        currentGroup.dateCount++;
        currentGroup.ids.push(date.id);
      } else {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          key: `${date.blocked_date}-${unitKey}-${reasonKey}`,
          startDate: date.blocked_date,
          endDate: date.blocked_date,
          reason: date.reason,
          unit_id: date.unit_id,
          unitName: date.units?.name || 'All Rooms',
          unitNumber: date.units?.unit_number || null,
          dateCount: 1,
          ids: [date.id],
        };
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [blockedDates]);

  // Filter grouped dates
  const filteredGroups = useMemo(() => {
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    return groupedBlockedDates.filter(group => {
      // Unit filter
      if (filterUnitId !== "all" && group.unit_id !== filterUnitId && group.unit_id !== null) {
        return false;
      }
      if (filterUnitId !== "all" && group.unit_id === null) {
        // "All Rooms" blocks should show for any unit filter
      }

      // Date filter
      const endDate = parseISO(group.endDate);
      if (filterDateRange === "future" && isBefore(endDate, today)) {
        return false;
      }
      if (filterDateRange === "thisMonth") {
        const startDate = parseISO(group.startDate);
        if (isAfter(startDate, monthEnd) || isBefore(endDate, monthStart)) {
          return false;
        }
      }

      // Reason search
      if (searchReason && group.reason && !group.reason.toLowerCase().includes(searchReason.toLowerCase())) {
        return false;
      }
      if (searchReason && !group.reason) {
        return false;
      }

      return true;
    });
  }, [groupedBlockedDates, filterUnitId, filterDateRange, searchReason]);

  const handleUnitToggle = (unitId: string) => {
    setSelectedUnitIds(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  const handleSelectAllUnits = () => {
    if (selectedUnitIds.length === units.length + 1) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(['all', ...units.map(u => u.id)]);
    }
  };

  const handleAddBlockedDate = async () => {
    if (!dateRange?.from) {
      toast.error("Please select at least a start date");
      return;
    }

    if (selectedUnitIds.length === 0) {
      toast.error("Please select at least one room");
      return;
    }

    setLoading(true);
    try {
      const endDate = dateRange.to || dateRange.from;
      const datesInRange = eachDayOfInterval({
        start: dateRange.from,
        end: endDate,
      });

      // Determine which unit IDs to block for
      const targetUnitIds = selectedUnitIds.includes('all') 
        ? [null] // null means all rooms
        : selectedUnitIds;

      const insertRecords = targetUnitIds.flatMap(unitId =>
        datesInRange.map(date => ({
          blocked_date: format(date, "yyyy-MM-dd"),
          unit_id: unitId,
          reason: reason.trim() || null,
        }))
      );

      const { error } = await supabase
        .from("blocked_dates")
        .insert(insertRecords);

      if (error) {
        if (error.code === "23505") {
          toast.error("Some dates are already blocked for the selected room(s)");
        } else {
          throw error;
        }
        return;
      }

      const unitText = selectedUnitIds.includes('all') 
        ? "all rooms" 
        : `${selectedUnitIds.length} room${selectedUnitIds.length > 1 ? 's' : ''}`;
      
      const dateCount = datesInRange.length;
      toast.success(`${dateCount} date${dateCount > 1 ? 's' : ''} blocked for ${unitText}`);
      
      setDateRange(undefined);
      setSelectedUnitIds([]);
      setReason("");
      setDialogOpen(false);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error adding blocked date:", error);
      toast.error("Failed to block dates");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (group: GroupedBlockedDates) => {
    try {
      const { error } = await supabase
        .from("blocked_dates")
        .delete()
        .in("id", group.ids);

      if (error) throw error;

      toast.success(`${group.dateCount} date${group.dateCount > 1 ? 's' : ''} unblocked`);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error deleting blocked dates:", error);
      toast.error("Failed to unblock dates");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedGroups.size === 0) return;

    const groupsToDelete = filteredGroups.filter(g => selectedGroups.has(g.key));
    const idsToDelete = groupsToDelete.flatMap(g => g.ids);
    
    try {
      const { error } = await supabase
        .from("blocked_dates")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      toast.success(`${idsToDelete.length} date${idsToDelete.length > 1 ? 's' : ''} unblocked`);
      setSelectedGroups(new Set());
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error bulk deleting blocked dates:", error);
      toast.error("Failed to unblock dates");
    }
  };

  const toggleGroupSelection = (key: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGroups.size === filteredGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filteredGroups.map(g => g.key)));
    }
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleOpenEditDialog = (group: GroupedBlockedDates) => {
    setEditingGroup(group);
    setEditReason(group.reason || "");
    setEditDateRange({
      from: parseISO(group.startDate),
      to: parseISO(group.endDate),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateBlockedDates = async () => {
    if (!editingGroup || !editDateRange?.from) return;

    setEditLoading(true);
    try {
      const newStartDate = format(editDateRange.from, "yyyy-MM-dd");
      const newEndDate = format(editDateRange.to || editDateRange.from, "yyyy-MM-dd");
      const reasonChanged = (editReason.trim() || null) !== editingGroup.reason;
      const datesChanged = newStartDate !== editingGroup.startDate || newEndDate !== editingGroup.endDate;

      if (!datesChanged && !reasonChanged) {
        toast.info("No changes to save");
        setEditDialogOpen(false);
        return;
      }

      if (datesChanged) {
        // Delete old records and insert new ones
        const { error: deleteError } = await supabase
          .from("blocked_dates")
          .delete()
          .in("id", editingGroup.ids);

        if (deleteError) throw deleteError;

        // Generate new date records
        const datesInRange = eachDayOfInterval({
          start: editDateRange.from,
          end: editDateRange.to || editDateRange.from,
        });

        const insertRecords = datesInRange.map(date => ({
          blocked_date: format(date, "yyyy-MM-dd"),
          unit_id: editingGroup.unit_id,
          reason: editReason.trim() || null,
        }));

        const { error: insertError } = await supabase
          .from("blocked_dates")
          .insert(insertRecords);

        if (insertError) {
          if (insertError.code === "23505") {
            toast.error("Some dates are already blocked for this room");
          } else {
            throw insertError;
          }
          return;
        }

        toast.success("Blocked dates updated successfully");
      } else {
        // Only reason changed, just update
        const { error } = await supabase
          .from("blocked_dates")
          .update({ reason: editReason.trim() || null })
          .in("id", editingGroup.ids);

        if (error) throw error;
        toast.success("Reason updated successfully");
      }

      setEditDialogOpen(false);
      setEditingGroup(null);
      setEditReason("");
      setEditDateRange(undefined);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error updating blocked dates:", error);
      toast.error("Failed to update blocked dates");
    } finally {
      setEditLoading(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    
    if (start === end) {
      return format(startDate, "MMM d, yyyy");
    }
    
    if (startDate.getFullYear() === endDate.getFullYear()) {
      if (startDate.getMonth() === endDate.getMonth()) {
        return `${format(startDate, "MMM d")} - ${format(endDate, "d, yyyy")}`;
      }
      return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
    }
    
    return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
  };

  const blockedDateObjects = blockedDates.map(d => parseISO(d.blocked_date));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5" />
              Blocked Dates Management
            </CardTitle>
            <CardDescription>
              Block dates from public booking for maintenance, events, or other reasons
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Block Dates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Block Dates</DialogTitle>
                <DialogDescription>
                  Select a date range and rooms to block from public booking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Multi-Unit Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rooms</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllUnits}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      {selectedUnitIds.length === units.length + 1 ? "Clear All" : "Select All"}
                    </Button>
                  </div>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-background">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="unit-all"
                        checked={selectedUnitIds.includes('all')}
                        onCheckedChange={() => handleUnitToggle('all')}
                      />
                      <label
                        htmlFor="unit-all"
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        All Rooms
                      </label>
                    </div>
                    {units.map((unit) => (
                      <div key={unit.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`unit-${unit.id}`}
                          checked={selectedUnitIds.includes(unit.id)}
                          onCheckedChange={() => handleUnitToggle(unit.id)}
                          disabled={selectedUnitIds.includes('all')}
                        />
                        <label
                          htmlFor={`unit-${unit.id}`}
                          className={cn(
                            "text-sm cursor-pointer flex-1",
                            selectedUnitIds.includes('all') && "text-muted-foreground"
                          )}
                        >
                          #{unit.unit_number} - {unit.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  {selectedUnitIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedUnitIds.includes('all') 
                        ? "Blocking all rooms" 
                        : `${selectedUnitIds.length} room${selectedUnitIds.length > 1 ? 's' : ''} selected`}
                    </p>
                  )}
                </div>

                {/* Single Date Range Picker */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          <span className="text-muted-foreground">Select date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        disabled={(date) => date < startOfDay(new Date())}
                        initialFocus
                        numberOfMonths={2}
                        className="pointer-events-auto"
                        modifiers={{
                          blocked: blockedDateObjects,
                        }}
                        modifiersClassNames={{
                          blocked: "bg-destructive/30 text-destructive-foreground",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Maintenance, Private event"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={handleAddBlockedDate}
                  disabled={!dateRange?.from || selectedUnitIds.length === 0 || loading}
                  className="w-full"
                >
                  {loading ? "Blocking..." : "Block Dates"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={filterUnitId} onValueChange={setFilterUnitId}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Units</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  #{unit.unit_number} - {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDateRange} onValueChange={(v) => setFilterDateRange(v as any)}>
            <SelectTrigger className="w-[140px] h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="future">Future Only</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[150px]">
            <Input
              placeholder="Search by reason..."
              value={searchReason}
              onChange={(e) => setSearchReason(e.target.value)}
              className="h-9 pr-8"
            />
            {searchReason && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchReason("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {filteredGroups.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedGroups.size === filteredGroups.length && filteredGroups.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedGroups.size > 0 
                  ? `${selectedGroups.size} selected` 
                  : `${filteredGroups.length} blocked period${filteredGroups.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            {selectedGroups.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            )}
          </div>
        )}

        {/* Grouped Blocked Dates List */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {blockedDates.length === 0 
              ? 'No blocked dates. Click "Block Dates" to add some.'
              : 'No blocked dates match your filters.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => (
              <div
                key={group.key}
                className="border rounded-lg bg-card overflow-hidden"
              >
                <div 
                  className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={(e) => {
                    // Don't open edit dialog if clicking on checkbox, expand button, or delete button
                    const target = e.target as HTMLElement;
                    if (target.closest('button') || target.closest('[role="checkbox"]')) {
                      return;
                    }
                    handleOpenEditDialog(group);
                  }}
                >
                  <Checkbox
                    checked={selectedGroups.has(group.key)}
                    onCheckedChange={() => toggleGroupSelection(group.key)}
                  />
                  
                  {group.dateCount > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => toggleGroupExpanded(group.key)}
                    >
                      {expandedGroups.has(group.key) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {formatDateRange(group.startDate, group.endDate)}
                      </span>
                      {group.dateCount > 1 && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {group.dateCount} days
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span>
                        {group.unit_id 
                          ? `#${group.unitNumber} - ${group.unitName}` 
                          : "All Rooms"}
                      </span>
                      {group.reason ? (
                        <>
                          <span>•</span>
                          <span className="truncate">{group.reason}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60 italic flex items-center gap-1">
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">Click to add reason</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGroup(group)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Expanded dates list */}
                {expandedGroups.has(group.key) && group.dateCount > 1 && (
                  <div className="border-t bg-muted/30 px-4 py-2 space-y-1">
                    {eachDayOfInterval({
                      start: parseISO(group.startDate),
                      end: parseISO(group.endDate),
                    }).map((date) => (
                      <div
                        key={format(date, "yyyy-MM-dd")}
                        className="text-sm text-muted-foreground"
                      >
                        {format(date, "EEEE, MMMM d, yyyy")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Reason Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Blocked Date Reason</DialogTitle>
              <DialogDescription>
                {editingGroup && (
                  <>
                    {formatDateRange(editingGroup.startDate, editingGroup.endDate)}
                    {" • "}
                    {editingGroup.unit_id 
                      ? `#${editingGroup.unitNumber} - ${editingGroup.unitName}` 
                      : "All Rooms"}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Date Range Picker */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      {editDateRange?.from ? (
                        editDateRange.to && editDateRange.to.getTime() !== editDateRange.from.getTime() ? (
                          <>
                            {format(editDateRange.from, "MMM d, yyyy")} - {format(editDateRange.to, "MMM d, yyyy")}
                          </>
                        ) : (
                          format(editDateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        <span className="text-muted-foreground">Select date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <Calendar
                      mode="range"
                      selected={editDateRange}
                      onSelect={setEditDateRange}
                      initialFocus
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Reason (Optional)</Label>
                <Input
                  id="edit-reason"
                  placeholder="e.g., Maintenance, Private event"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateBlockedDates} disabled={!editDateRange?.from || editLoading}>
                  {editLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
