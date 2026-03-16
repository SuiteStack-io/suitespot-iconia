

## Fix: Missing Modification Email on Manual Reservation Edit

### Root Cause

The `handleSave` function in `src/pages/ReservationDetail.tsx` (line 656-691) updates the reservation in the database but **never invokes `send-modification-notification`**. The modification notification edge function is only called from `BookingComReservations.tsx` (the screenshot parsing flow). So manual edits via the reservation detail page never trigger a modification email.

### Fix

In `src/pages/ReservationDetail.tsx`, after the successful update (line 656), add logic to detect if dates or price changed and invoke `send-modification-notification`:

1. **Detect meaningful changes**: Compare old vs new `check_in_date`, `check_out_date`, and `total_price`. Only send the modification email if at least one changed AND the reservation is not being cancelled (cancellation already has its own notification).

2. **Call the edge function**: After the existing success toast (line 657), before the cancellation check block, add:
   ```typescript
   const datesOrPriceChanged = (
     format(formData.check_in_date, 'yyyy-MM-dd') !== reservation?.check_in_date ||
     format(formData.check_out_date, 'yyyy-MM-dd') !== reservation?.check_out_date ||
     total !== reservation?.total_price
   );
   
   if (datesOrPriceChanged && !isBeingCancelled) {
     try {
       await supabase.functions.invoke('send-modification-notification', {
         body: {
           booking_reference: reservation?.booking_reference,
           guest_names: formData.guest_names,
           room_name: reservation?.units?.booking_com_name || reservation?.units?.name || '',
           room_number: reservation?.units?.unit_number || '',
           old_check_in: reservation?.check_in_date,
           old_check_out: reservation?.check_out_date,
           new_check_in: format(formData.check_in_date, 'yyyy-MM-dd'),
           new_check_out: format(formData.check_out_date, 'yyyy-MM-dd'),
           old_total_price: reservation?.total_price,
           new_total_price: total,
           currency: formData.currency || reservation?.currency || 'USD',
           channel: reservation?.channel,
           source: formData.source,
           property_id: reservation?.property_id,
         },
       });
     } catch (notifyErr) {
       console.error('Error sending modification notification:', notifyErr);
     }
   }
   ```

3. Insert this block at line 658, right after the success toast and before the cancellation notification check (line 660).

### No Changes To
- The edge function itself (already works correctly)
- Email layout, sender, or recipient logic
- Any other notification flows

