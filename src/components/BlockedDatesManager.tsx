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
import { useAuth } from "@/lib/auth";
import { format, parseISO, eachDayOfInterval, differenceInDays, addDays, isAfter, isBefore, startOfDay, endOfMonth, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2, CalendarIcon, Filter, X, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { usePropertyId, withPropertyFilter } from "@/hooks/usePropertyFilter";
import {
  calculateAvailabilityRanges,
  getRoomTypePrimaryUnitId,
} from "@/lib/availability-calculator";

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  booking_com_name?: string | null;
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
    booking_com_name?: string | null;
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
  roomTypeName: string | null;
  dateCount: number;
  ids: string[];
}

interface PendingBlockedDate {
  id: string;                   // crypto.randomUUID()
  roomTypeName: string;         // booking_com_name shared by all unitIds
  unitIds: string[];            // never null, never empty, all share roomTypeName
  unitLabels: string[];         // friendly labels (e.g. "#101 - Suite") for optional expansion
  totalUnitsInRoomType: number; // for "X of Y units" display
  dateFrom: string;             // yyyy-MM-dd inclusive
  dateTo: string;               // yyyy-MM-dd inclusive
  datesInRange: string[];       // yyyy-MM-dd inclusive enumeration
  reason: string | null;
  addedAt: Date;
}

interface ChannexAvailabilityUpdate {
  property_id: string;
  room_type_id: string;
  date_from: string;
  date_to: string;
  availability: number;
}

export const BlockedDatesManager = () => {
  const { hasPermission } = useAuth();
  const propertyId = usePropertyId();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Staged changes (Apply → Save Changes pattern)
  const [pendingBlockedDates, setPendingBlockedDates] = useState<PendingBlockedDate[]>([]);
  const [savingChanges, setSavingChanges] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedBlockedDates | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
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
  }, [propertyId]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await withPropertyFilter(supabase
        .from("units")
        .select("id, name, unit_number, booking_com_name")
        .eq("status", "available"), propertyId)
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
      // First get unit IDs for the active property
      let unitIds: string[] = [];
      if (propertyId) {
        const { data: propUnits } = await supabase
          .from("units")
          .select("id")
          .eq("property_id", propertyId);
        unitIds = (propUnits || []).map(u => u.id);
      }

      let query = supabase
        .from("blocked_dates")
        .select(`
          *,
          units (
            name,
            unit_number,
            booking_com_name
          )
        `)
        .order("blocked_date", { ascending: true });

      if (propertyId && unitIds.length > 0) {
        query = query.in("unit_id", unitIds);
      } else if (propertyId && unitIds.length === 0) {
        setBlockedDates([]);
        return;
      }

      const { data, error } = await query;
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
      (a.unit_id || '').localeCompare(b.unit_id || '') ||
      (a.reason || '').localeCompare(b.reason || '') ||
      a.blocked_date.localeCompare(b.blocked_date)
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
          unitName: date.units?.booking_com_name || date.units?.name || 'All Rooms',
          unitNumber: date.units?.unit_number || null,
          roomTypeName: date.units?.booking_com_name || null,
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

  // ────────────────────────────────────────────────────────────────────
  // Apply → Save Changes pattern
  // handleApply: NO database writes. Expand "all rooms" into one
  // PendingBlockedDate per room type at this point so handleSaveAllChanges
  // is a uniform loop with no special-case branches.
  // ────────────────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!dateRange?.from) {
      toast.error("Please select at least a start date");
      return;
    }
    if (selectedUnitIds.length === 0) {
      toast.error("Please select at least one room");
      return;
    }
    if (!propertyId) {
      toast.error("No property selected");
      return;
    }

    setApplying(true);
    try {
      const endDate = dateRange.to || dateRange.from;
      const datesInRange = eachDayOfInterval({ start: dateRange.from, end: endDate })
        .map(d => format(d, "yyyy-MM-dd"));
      const dateFrom = format(dateRange.from, "yyyy-MM-dd");
      const dateTo = format(endDate, "yyyy-MM-dd");
      const trimmedReason = reason.trim() || null;

      // Pull canonical unit set the same way calculateAvailabilityRanges does.
      const { data: allPropertyUnits, error: unitsErr } = await supabase
        .from("units")
        .select("id, booking_com_name, name, unit_number")
        .eq("property_id", propertyId)
        .neq("status", "maintenance");

      if (unitsErr) throw unitsErr;

      const isAllRooms = selectedUnitIds.includes("all");

      // Resolve target units
      let targetUnits: Array<{ id: string; booking_com_name: string | null; name: string; unit_number: string | null }> = [];
      if (isAllRooms) {
        targetUnits = (allPropertyUnits || []).filter(u => {
          if (!u.booking_com_name) {
            console.warn(
              `[BlockedDatesManager] Skipping unit ${u.id} (#${u.unit_number}) — no booking_com_name set`,
            );
            return false;
          }
          return true;
        });
      } else {
        const selectedSet = new Set(selectedUnitIds);
        targetUnits = (allPropertyUnits || []).filter(u => selectedSet.has(u.id));
        // Drop units without a booking_com_name (can't sync them)
        targetUnits = targetUnits.filter(u => {
          if (!u.booking_com_name) {
            console.warn(
              `[BlockedDatesManager] Selected unit ${u.id} (#${u.unit_number}) has no booking_com_name — skipped`,
            );
            return false;
          }
          return true;
        });
      }

      if (targetUnits.length === 0) {
        toast.error("No eligible rooms (selected rooms have no Channex room type configured)");
        return;
      }

      // Count totals per room type (uses the FULL property unit set, not just selected)
      const totalsPerRoomType = new Map<string, number>();
      for (const u of allPropertyUnits || []) {
        if (!u.booking_com_name) continue;
        totalsPerRoomType.set(
          u.booking_com_name,
          (totalsPerRoomType.get(u.booking_com_name) || 0) + 1,
        );
      }

      // Group target units by room type
      const groupsByRoomType = new Map<string, typeof targetUnits>();
      for (const u of targetUnits) {
        const key = u.booking_com_name as string;
        if (!groupsByRoomType.has(key)) groupsByRoomType.set(key, []);
        groupsByRoomType.get(key)!.push(u);
      }

      // Build expanded pending entries (one per room type)
      const expanded: PendingBlockedDate[] = [];
      for (const [roomTypeName, group] of groupsByRoomType.entries()) {
        expanded.push({
          id: crypto.randomUUID(),
          roomTypeName,
          unitIds: group.map(u => u.id),
          unitLabels: group.map(u => `#${u.unit_number ?? ""} - ${u.name}`),
          totalUnitsInRoomType: totalsPerRoomType.get(roomTypeName) || group.length,
          dateFrom,
          dateTo,
          datesInRange,
          reason: trimmedReason,
          addedAt: new Date(),
        });
      }

      setPendingBlockedDates(prev => [...prev, ...expanded]);

      // Reset form + close dialog
      setDateRange(undefined);
      setSelectedUnitIds([]);
      setReason("");
      setDialogOpen(false);

      toast.success(
        `${expanded.length} room type${expanded.length > 1 ? "s" : ""} added to pending changes for ${datesInRange.length} date${datesInRange.length > 1 ? "s" : ""}`,
      );
    } catch (error: any) {
      console.error("Error applying blocked date:", error);
      toast.error(error.message || "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  const handleRemovePending = (id: string) => {
    setPendingBlockedDates(prev => prev.filter(p => p.id !== id));
  };

  const handleClearPending = () => {
    setPendingBlockedDates([]);
  };

  // ────────────────────────────────────────────────────────────────────
  // handleSaveAllChanges — straight loop, no special cases.
  // ────────────────────────────────────────────────────────────────────
  const handleSaveAllChanges = async () => {
    if (pendingBlockedDates.length === 0 || !propertyId) return;

    setSavingChanges(true);
    try {
      // 1. Flat-map all pending → insert records (no null unit_id ever)
      const insertRecords = pendingBlockedDates.flatMap(pending =>
        pending.unitIds.flatMap(unitId =>
          pending.datesInRange.map(d => ({
            blocked_date: d,
            unit_id: unitId,
            reason: pending.reason,
          })),
        ),
      );

      const { error: insertError } = await supabase
        .from("blocked_dates")
        .insert(insertRecords);

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("Some dates are already blocked for the selected room(s)");
        } else {
          throw insertError;
        }
        return;
      }

      // 2. Build Channex updates. Merge pendings sharing
      // (roomTypeName, dateFrom, dateTo) so we don't recompute the same
      // range twice. Never merge across different room types or ranges.
      const uniqueKeys = new Map<string, { roomTypeName: string; dateFrom: string; dateTo: string }>();
      for (const p of pendingBlockedDates) {
        const k = `${p.roomTypeName}|${p.dateFrom}|${p.dateTo}`;
        if (!uniqueKeys.has(k)) {
          uniqueKeys.set(k, { roomTypeName: p.roomTypeName, dateFrom: p.dateFrom, dateTo: p.dateTo });
        }
      }

      const updates: ChannexAvailabilityUpdate[] = [];
      for (const { roomTypeName, dateFrom, dateTo } of uniqueKeys.values()) {
        const exclusiveTo = format(addDays(parseISO(dateTo), 1), "yyyy-MM-dd");
        const ranges = await calculateAvailabilityRanges(
          roomTypeName,
          dateFrom,
          exclusiveTo,
          propertyId,
        );
        const primaryUnitId = await getRoomTypePrimaryUnitId(roomTypeName, propertyId);
        if (!primaryUnitId) {
          console.warn(`[BlockedDatesManager] No Channex mapping for ${roomTypeName} — skipped`);
          continue;
        }
        for (const r of ranges) {
          updates.push({
            property_id: propertyId,
            room_type_id: primaryUnitId,
            date_from: r.date_from,
            date_to: r.date_to,
            availability: r.availability,
          });
        }
      }

      // 3. Single batched Channex push
      if (updates.length > 0) {
        const { error: pushError } = await supabase.functions.invoke(
          "channex-push-availability",
          { body: { updates } },
        );
        if (pushError) {
          console.error("Channex push failed:", pushError);
          toast.error("Saved to database, but Channex sync failed. Check sync logs.");
        }
      }

      const totalDates = pendingBlockedDates.reduce((sum, p) => sum + p.datesInRange.length, 0);
      toast.success(
        `${totalDates} date${totalDates > 1 ? "s" : ""} blocked across ${uniqueKeys.size} room type${uniqueKeys.size > 1 ? "s" : ""} and synced to Channex`,
      );

      setPendingBlockedDates([]);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error saving blocked dates:", error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSavingChanges(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Channex push helper for delete/edit handlers.
  // Resolves room types from group(s); falls back to "every room type at
  // this property" when a group's unit_id is null (legacy "all rooms" data).
  // ────────────────────────────────────────────────────────────────────
  const pushAvailabilityForRanges = async (
    affected: Array<{ roomTypeName: string | null; startDate: string; endDate: string }>,
  ) => {
    if (!propertyId || affected.length === 0) return;

    // Expand any null-room-type entry into every room type at this property
    let nullExpansion: string[] | null = null;
    const dedup = new Map<string, { roomTypeName: string; dateFrom: string; dateTo: string }>();

    for (const a of affected) {
      if (a.roomTypeName) {
        const key = `${a.roomTypeName}|${a.startDate}|${a.endDate}`;
        if (!dedup.has(key)) {
          dedup.set(key, { roomTypeName: a.roomTypeName, dateFrom: a.startDate, dateTo: a.endDate });
        }
      } else {
        if (nullExpansion === null) {
          const { data } = await supabase
            .from("units")
            .select("booking_com_name")
            .eq("property_id", propertyId)
            .neq("status", "maintenance");
          nullExpansion = Array.from(
            new Set(
              (data || [])
                .map((u: any) => u.booking_com_name)
                .filter((n: any) => !!n),
            ),
          ) as string[];
        }
        for (const rt of nullExpansion) {
          const key = `${rt}|${a.startDate}|${a.endDate}`;
          if (!dedup.has(key)) {
            dedup.set(key, { roomTypeName: rt, dateFrom: a.startDate, dateTo: a.endDate });
          }
        }
      }
    }

    const updates: ChannexAvailabilityUpdate[] = [];
    for (const { roomTypeName, dateFrom, dateTo } of dedup.values()) {
      const exclusiveTo = format(addDays(parseISO(dateTo), 1), "yyyy-MM-dd");
      const ranges = await calculateAvailabilityRanges(
        roomTypeName,
        dateFrom,
        exclusiveTo,
        propertyId,
      );
      const primaryUnitId = await getRoomTypePrimaryUnitId(roomTypeName, propertyId);
      if (!primaryUnitId) continue;
      for (const r of ranges) {
        updates.push({
          property_id: propertyId,
          room_type_id: primaryUnitId,
          date_from: r.date_from,
          date_to: r.date_to,
          availability: r.availability,
        });
      }
    }

    if (updates.length === 0) return;
    const { error } = await supabase.functions.invoke(
      "channex-push-availability",
      { body: { updates } },
    );
    if (error) {
      console.error("Channex push failed:", error);
      toast.error("Database updated, but Channex sync failed. Check sync logs.");
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

      await pushAvailabilityForRanges([
        { roomTypeName: group.roomTypeName, startDate: group.startDate, endDate: group.endDate },
      ]);

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

      const affected = groupsToDelete.map(g => ({
        roomTypeName: g.roomTypeName,
        startDate: g.startDate,
        endDate: g.endDate,
      }));
      await pushAvailabilityForRanges(affected);

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
    setEditUnitId(group.unit_id);
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
      const unitChanged = editUnitId !== editingGroup.unit_id;

      if (!datesChanged && !reasonChanged && !unitChanged) {
        toast.info("No changes to save");
        setEditDialogOpen(false);
        return;
      }

      // Resolve new room type name (for Channex push)
      let newRoomTypeName: string | null = null;
      if (editUnitId) {
        const u = units.find(x => x.id === editUnitId);
        newRoomTypeName = u?.booking_com_name || null;
      }

      if (datesChanged || unitChanged) {
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
          unit_id: editUnitId,
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

        // Push Channex covering union of old + new room type / range
        await pushAvailabilityForRanges([
          { roomTypeName: editingGroup.roomTypeName, startDate: editingGroup.startDate, endDate: editingGroup.endDate },
          { roomTypeName: newRoomTypeName, startDate: newStartDate, endDate: newEndDate },
        ]);
      } else {
        // Only reason changed, just update — no Channex availability change.
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
      setEditUnitId(null);
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
            {hasPermission('can_block_dates') && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Block Dates
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Block Dates</DialogTitle>
                <DialogDescription>
                  Select a date range and rooms, then click Apply to stage the change. Click Save Changes to commit and sync to Channex.
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
                          #{unit.unit_number} - {unit.booking_com_name || unit.name}
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
                  onClick={handleApply}
                  disabled={!dateRange?.from || selectedUnitIds.length === 0 || applying}
                  className="w-full"
                >
                  {applying ? "Applying..." : "Apply"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Changes panel */}
        {pendingBlockedDates.length > 0 && (
          <div className="border rounded-lg bg-accent/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  Pending Changes ({pendingBlockedDates.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearPending}
                  disabled={savingChanges}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAllChanges}
                  disabled={savingChanges}
                >
                  {savingChanges ? "Saving..." : "Save Changes →"}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              {pendingBlockedDates.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 bg-background rounded border text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.roomTypeName}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {p.unitIds.length} of {p.totalUnitsInRoomType} unit
                        {p.totalUnitsInRoomType > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{formatDateRange(p.dateFrom, p.dateTo)}</span>
                      <span>•</span>
                      <span>
                        {p.datesInRange.length} date{p.datesInRange.length > 1 ? "s" : ""}
                      </span>
                      {p.reason && (
                        <>
                          <span>•</span>
                          <span className="truncate">{p.reason}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemovePending(p.id)}
                    disabled={savingChanges}
                    aria-label="Remove pending change"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  #{unit.unit_number} - {unit.booking_com_name || unit.name}
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
              {/* Room/Unit Selector */}
              <div className="space-y-2">
                <Label>Room/Unit</Label>
                <Select
                  value={editUnitId || "all"}
                  onValueChange={(value) => setEditUnitId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="all">All Rooms</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        #{unit.unit_number} - {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
