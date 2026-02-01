

## Support Reservation Changes via Booking.com Screenshot

### Summary
Enable the system to detect and handle reservation modifications (date changes, price updates, etc.) when uploading Booking.com screenshots that show "Reservation changes" in the header. When a matching booking reference already exists, instead of blocking the import with an error, the system will offer to update the existing reservation(s) with the new details.

---

### Current Behavior
1. User uploads a Booking.com screenshot
2. AI parses reservation details (dates, prices, guests, etc.)
3. System checks if `booking_reference` already exists in database
4. If exists: Shows error alert "Reservation Already Exists" and blocks creation
5. If not exists: Allows creating new reservation

### New Behavior
1. User uploads a Booking.com screenshot
2. AI parses reservation details AND detects if it's a modification ("Reservation changes" header)
3. System checks if `booking_reference` already exists
4. If exists AND is a modification screenshot:
   - Show "Update Reservation" dialog instead of error
   - Compare old vs new values (dates, prices, guests)
   - Allow updating the existing reservation(s) with new data
5. If exists AND is NOT a modification: Show existing error behavior
6. If not exists: Create new reservation (existing flow)

---

### Technical Changes

#### 1. Update Edge Function: `supabase/functions/parse-reservation-screenshot/index.ts`

Add detection for "Reservation changes" indicator and new fields to the AI prompt:

```typescript
interface ParsedReservation {
  // ... existing fields ...
  isModification?: boolean;  // NEW: true if screenshot shows "Reservation changes"
  changeCount?: number;      // NEW: number of changes (e.g., "(4)" from header)
}
```

Update AI prompt to extract:
```
"isModification": boolean (true if you see "Reservation changes" header or modification indicators),
"changeCount": number or null (if you see "Reservation changes (4)", extract the number 4),
```

#### 2. Update Frontend: `src/pages/BookingComReservations.tsx`

**A. Add new state for modification mode:**
```typescript
const [isModificationMode, setIsModificationMode] = useState(false);
const [existingReservationsToUpdate, setExistingReservationsToUpdate] = useState<any[]>([]);
const [originalReservationData, setOriginalReservationData] = useState<any>(null);
```

**B. Update `processFile` function (around line 253-266):**
When checking for existing reservation, also fetch full reservation data for comparison:
```typescript
// Check if booking already exists
const { data: existing } = await supabase
  .from('reservations')
  .select('*')  // Fetch all fields for comparison
  .eq('booking_reference', data.data.bookingReference)
  .neq('status', 'cancelled');

// If exists and this is a modification screenshot
if (existing && existing.length > 0 && data.data.isModification) {
  setIsModificationMode(true);
  setExistingReservationsToUpdate(existing);
  setOriginalReservationData(existing[0]); // For comparison display
  setExistingReservation(null); // Don't show the error alert
} else {
  setExistingReservation(existing?.[0] || null);
  setIsModificationMode(false);
}
```

**C. Add new update handler function:**
```typescript
const handleUpdateReservation = async () => {
  if (!parsedData || existingReservationsToUpdate.length === 0) return;
  setCreating(true);
  
  try {
    // Handle multi-room bookings (update all linked reservations)
    for (const reservation of existingReservationsToUpdate) {
      const updateData: any = {
        check_in_date: parsedData.checkInDate,
        check_out_date: parsedData.checkOutDate,
        total_price: parsedData.totalPrice,
        number_of_guests: parsedData.numberOfGuests,
        adults: parsedData.adults,
        children: parsedData.children,
        notes: `Updated from Booking.com modification. ${parsedData.notes || ''}`,
        updated_at: new Date().toISOString(),
      };
      
      // Recalculate derived fields
      const nights = differenceInCalendarDays(
        parseISO(parsedData.checkOutDate), 
        parseISO(parsedData.checkInDate)
      );
      updateData.nights = nights;
      updateData.price_per_night = parsedData.totalPrice && nights > 0 
        ? parsedData.totalPrice / nights 
        : null;
      
      // Update commission if provided
      if (parsedData.commissionAmount) {
        updateData.commission_amount = parsedData.commissionAmount;
        updateData.commission_rate = parsedData.totalPrice 
          ? (parsedData.commissionAmount / parsedData.totalPrice) * 100 
          : null;
      }
      if (parsedData.commissionableAmount) {
        updateData.net_revenue = parsedData.commissionableAmount;
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservation.id);
      
      if (error) throw error;
    }
    
    toast({
      title: 'Success',
      description: `Updated ${existingReservationsToUpdate.length} reservation(s)`,
    });
    
    // Reset state
    setShowPreview(false);
    setParsedData(null);
    setIsModificationMode(false);
    setExistingReservationsToUpdate([]);
    
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message || 'Failed to update reservation',
      variant: 'destructive',
    });
  } finally {
    setCreating(false);
  }
};
```

**D. Update Preview Dialog UI (around line 1580-1595):**
Replace the existing "Reservation Already Exists" error alert with a modification-aware display:

```tsx
{/* Show modification comparison when updating existing reservation */}
{isModificationMode && existingReservationsToUpdate.length > 0 && (
  <Alert className="border-blue-200 bg-blue-50">
    <ArrowLeftRight className="h-4 w-4 text-blue-600" />
    <AlertTitle className="text-blue-800">Reservation Modification Detected</AlertTitle>
    <AlertDescription className="text-blue-700">
      <div className="mt-2 space-y-2">
        <p className="font-medium">Changes detected for booking {parsedData?.bookingReference}:</p>
        
        {/* Date Change Comparison */}
        {(originalReservationData?.check_in_date !== parsedData?.checkInDate ||
          originalReservationData?.check_out_date !== parsedData?.checkOutDate) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through">
              {format(parseISO(originalReservationData.check_in_date), 'MMM d')} - 
              {format(parseISO(originalReservationData.check_out_date), 'MMM d, yyyy')}
            </span>
            <span>→</span>
            <span className="font-medium text-blue-800">
              {format(parseISO(parsedData.checkInDate), 'MMM d')} - 
              {format(parseISO(parsedData.checkOutDate), 'MMM d, yyyy')}
            </span>
          </div>
        )}
        
        {/* Price Change Comparison */}
        {originalReservationData?.total_price !== parsedData?.totalPrice && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through">
              {parsedData?.currency} {originalReservationData.total_price}
            </span>
            <span>→</span>
            <span className="font-medium text-blue-800">
              {parsedData?.currency} {parsedData?.totalPrice}
            </span>
          </div>
        )}
        
        <p className="text-xs mt-2">
          This will update {existingReservationsToUpdate.length} existing reservation(s).
        </p>
      </div>
    </AlertDescription>
  </Alert>
)}

{/* Keep existing error for non-modification duplicates */}
{existingReservation && !isModificationMode && (
  <Alert variant="destructive">
    {/* existing error content */}
  </Alert>
)}
```

**E. Update Dialog Footer buttons (around line 2156-2180):**
```tsx
<Button 
  onClick={isModificationMode ? handleUpdateReservation : handleConfirmReservation} 
  disabled={
    creating || 
    (existingReservation !== null && !isModificationMode) || 
    // ... rest of existing conditions
  } 
>
  {creating ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      {isModificationMode ? 'Updating...' : 'Creating...'}
    </>
  ) : (
    isModificationMode
      ? `Update ${existingReservationsToUpdate.length} Reservation(s)`
      : // ... existing button text logic
  )}
</Button>
```

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Modification extends dates | Updates dates, recalculates nights and price per night |
| Modification shortens stay | Updates dates, recalculates amounts |
| Multi-room modification | Updates all reservations with same booking reference |
| New room conflicts with updated dates | Checks availability for new date range, shows warnings |
| Price change only | Updates total price and commission calculations |
| Guest count change | Updates number_of_guests, adults, children fields |

---

### Files to Modify

1. `supabase/functions/parse-reservation-screenshot/index.ts` - Add modification detection
2. `src/pages/BookingComReservations.tsx` - Handle update flow in UI

---

### Testing Checklist

- Upload a "Reservation changes" screenshot for an existing booking
- Verify modification is detected (blue info alert instead of red error)
- Verify old vs new values are displayed for comparison
- Confirm update saves new dates/prices correctly
- Test with multi-room bookings (all linked reservations update)
- Test uploading a duplicate that is NOT a modification (should still show error)

