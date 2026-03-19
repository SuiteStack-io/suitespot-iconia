

## Rewrite Monthly Summary Email — Design + Occupancy Fix + Performance Trends

### Summary
Full rewrite of `supabase/functions/generate-monthly-summary/index.ts` to match the dark navy design from the daily/weekly summaries, fix occupancy to exclude blocked rooms per-day, add 6-month performance trend sections with HTML/CSS bar charts, add ADR/RevPAR metrics, add booking source breakdown table, and use property-access-filtered recipients. No PDF (removed from all summaries per project memory).

### File: `supabase/functions/generate-monthly-summary/index.ts` — Full rewrite

#### 1. Design — Match Daily/Weekly
- Header: `background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
- Section headings: `color: #1e293b`
- Table headers: `background: #1e293b; color: white`
- Cards: `background: #f1f5f9; border: 1px solid #cbd5e1`
- Check-in/out rendered as source breakdown text (monthly has too many rows for individual tables)

#### 2. Fix Occupancy — Exclude Blocked Rooms Per Day
- Copy `computeWeekOccupancy` pattern from weekly summary
- For each day of the month, query `blocked_dates` for property units
- Available per day = total units - blocked units that day
- Aggregate: total sold / total available across all days
- Track daily data for highest/lowest day display
- MoM and YoY comparisons using same corrected calculation

#### 3. Revenue Section — ADR + RevPAR
- Gross, commissions, net (same `fetchRevenueData` logic: `neq Cancelled, is cancelled_at null, gte/lte check_in_date`)
- ADR = net revenue / occupied room nights
- RevPAR = net revenue / available room nights
- MoM and YoY comparisons for all metrics

#### 4. Recipients — Property Access Filtering
- Copy `getRecipients` from weekly summary (with property access + admin fallback)

#### 5. Performance Section — 6-Month Trends

**5a. Data fetching**: Loop over past 6 months (current + 5 prior), for each:
- Occupancy via blocked-room-aware daily loop
- New bookings count (`created_at` in month range)
- Net revenue (`total_price - commission_amount`)
- Also fetch same month last year for YoY

**5b. Occupancy Trend**: 6 horizontal bars + MoM card + YoY card

**5c. Bookings Trend**: 6 horizontal bars + MoM card + YoY card

**5d. Revenue Trend**: 6 horizontal bars + MoM card + YoY card

**5e. Booking Source Breakdown Table**:
- Query current month's bookings grouped by source
- Table: Source | Count | % | Revenue
- Compare source mix vs prior month

#### 6. Bar Chart + Comparison Card HTML
- Reuse `renderBarChart` and comparison card patterns from weekly summary
- Current month bar highlighted with blue left border
- MoM card: green ↑ / red ↓ with percentage and absolute values
- YoY card: same style, "vs [Month Year-1]" or "N/A — no data"

#### 7. Email Structure
1. Dark navy header ("SuiteSpot Monthly Summary" + property + month/year)
2. Check-ins count + source breakdown
3. Check-outs count + source breakdown
4. Occupancy (corrected, with highest/lowest day, room nights, MoM, YoY)
5. Revenue (gross, commissions, net, ADR, RevPAR, MoM, YoY)
6. New Bookings + source breakdown + avg value + avg stay
7. Performance section:
   - Occupancy Trend (6-month bars + MoM + YoY cards)
   - Bookings Trend (6-month bars + MoM + YoY cards)
   - Revenue Trend (6-month bars + MoM + YoY cards)
   - Source Breakdown table with MoM comparison
8. Footer

#### 8. No PDF
Per project memory, PDF generation was removed from all summary functions to prevent Edge Function crashes.

### Deployment
Deploy via `deploy_edge_functions(["generate-monthly-summary"])`.

