## Plan: Update Booking/Stay Window tooltip content

The Tooltip components are already wired (TooltipProvider wraps the dialog at line 811, and the Booking/Stay Window info icons already use `Tooltip > TooltipTrigger > TooltipContent` at lines 838–845 and 865–872). Only the tooltip text needs updating to include the definition + concrete example.

### Change in `src/pages/Promotions.tsx`

**Line 843** — replace Booking Window tooltip text:
> "When guests can book this promotion. Discounts only apply to reservations made within this window. Example: Set 'Apr 30 — May 31' to run a one-month promotional campaign."

**Line 870** — replace Stay Window tooltip text:
> "Which nights are eligible for the discount. Only stays falling within this date range will receive the promotional rate. Example: Set 'Jul 1 — Aug 31' to discount summer stays."

Also add `className="max-w-xs"` to both `TooltipContent` so the longer copy wraps nicely instead of stretching across the screen.

### Not changing
- No new imports (Tooltip primitives already imported).
- Form fields, validation, date pickers, dialog layout untouched.
- No other files modified.