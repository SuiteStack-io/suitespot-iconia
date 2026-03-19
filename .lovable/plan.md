

## Redesign Weekly Summary Email + Add Performance Trends

### Summary
Rewrite the `generate-weekly-summary` Edge Function to match the daily summary's dark navy design, fix occupancy to exclude blocked rooms, add 4-week trend sections (occupancy, bookings, revenue) with HTML/CSS bar charts, and add property-access-filtered recipients. No PDF attachment (memory notes confirm PDF generation was removed from all summary functions).

### Changes

**File: `supabase/functions/generate-weekly-summary/index.ts`** — Full rewrite

#### 1. Design — Match Daily Summary
- Header: `background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%)` (replace `#0EA5E9`)
- Section headings: `color: #1e293b` (replace `#0EA5E9`)
- Table headers: `background: #1e293b; color: white`
- Occupancy card: `background: #f1f5f9; border: 1px solid #cbd5e1` (replace light blue)
- Check-in/out sections: render as tables with Guest Name / Room / Source columns (like daily), joining `units!unit_id` for room display
- Use `formatRoomDisplay()` helper from daily summary

#### 2. Fix Occupancy Calculation
- For each day of the week, fetch `blocked_dates` for that date filtered to property units
- Available rooms per day = total units − blocked units for that day
- Daily occupancy rate = occupied / available (not occupied / total)
- Aggregate: total room nights sold / total available room nights across all 7 days
- Show average occupancy, highest/lowest day, room nights sold vs available

#### 3. Fix Recipients — Add Property Access Filtering
- Copy the `getRecipients` function from the daily summary (with property access filtering and role-based global access for admins)

#### 4. Add Performance Section — 4-Week Trends
Fetch data for 3 prior weeks (same Thu–Wed range shifted back 7/14/21 days) plus current week:

**4a. Occupancy Trend**
- Reuse the daily occupancy loop for each of the 4 weeks (excluding blocked rooms)
- Render 4 horizontal bars using inline CSS (`div` with `width: X%` relative to max)
- Current week highlighted with a left border accent
- WoW comparison card below: green ↑ or red ↓ with percentage change

**4b. New Bookings Trend**
- Query `reservations` with `created_at` in each week's range
- Same bar chart style, showing count
- WoW card with absolute and percentage change

**4c. Revenue Trend**
- Query `reservations` for each week: `total_price, commission_amount`
- Net revenue = `total_price - commission_amount` (matching Revenue Analytics logic)
- Bar chart showing formatted currency amounts
- WoW card with percentage and absolute change

#### 5. Bar Chart HTML/CSS Pattern
```text
Each bar row:
┌─────────────────────────────────────────────┐
│ Mar 12–18  [████████████████░░░░] 65.2%     │
│ Mar 5–11   [██████████████░░░░░░] 58.1%     │
│ Feb 26–Mar 4 [████████░░░░░░░░░░] 42.0%     │
│ Feb 19–25  [██████████████████░░] 71.3%     │
└─────────────────────────────────────────────┘
```
- Bar container: `background: #e2e8f0; border-radius: 4px; height: 24px`
- Bar fill: `background: #1e293b; width: {pct}%`
- Current week bar: `background: #334155` with `border-left: 3px solid #3b82f6`
- Labels and values in table cells alongside bars

#### 6. WoW Comparison Card Pattern
- `background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1; padding: 12px`
- Arrow: `↑` green (`#16a34a`) for positive, `↓` red (`#dc2626`) for negative
- Show percentage change and absolute values

#### 7. No PDF
Per project memory, PDF generation was removed from all summary functions. The user's request for PDF is noted but will be skipped since the project explicitly removed PDF to prevent Edge Function crashes from jsPDF.

#### 8. Email Structure (top to bottom)
1. Dark navy header
2. Check-ins table
3. Check-outs table  
4. Occupancy section (corrected calculation)
5. New Bookings with source breakdown
6. 📊 Performance: Occupancy Trend → Bookings Trend → Revenue Trend
7. Footer

### Deployment
After editing the file, deploy via `deploy_edge_functions(["generate-weekly-summary"])`.

