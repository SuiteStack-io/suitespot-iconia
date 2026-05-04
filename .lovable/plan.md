## Plan: Make all Dynamic Pricing sections collapsible

Apply the existing `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` pattern (already used by the Advanced — Occupancy & Revenue Tiers section at lines 997–1152) to every other Card section on `src/pages/DynamicPricing.tsx`.

### Sections to convert and default open state

| # | Section (line) | Default |
|---|----|----|
| 1 | Master Toggle — Enable Dynamic Pricing (643) | OPEN |
| 2 | Rate Guardrails (666) | OPEN |
| 3 | Day-of-Week Multipliers (890) | OPEN |
| 4 | Monthly Revenue Targets (928) | CLOSED |
| 5 | Last-Minute Strategy (969) | CLOSED |
| 6 | Advanced — Occupancy & Revenue Tiers (997) | CLOSED — already implemented, leave untouched |
| 7 | Pricing Dashboard (Card at line 1594, inside `PricingDashboard` component) | OPEN |
| 8 | Manual Overrides (Card at line 2590, inside `OverridesSection` component) | CLOSED |

Note: The user's list mentions a "Promotions" card on this page. There is none — promotions live on `/promotions`. Skipping (no such card exists on DynamicPricing.tsx). I'll mention this in the response.

### Implementation pattern (per section)

For each Card, mirror the Advanced section exactly:

```tsx
const [guardrailsOpen, setGuardrailsOpen] = useState(true); // or false per defaults

<Collapsible open={guardrailsOpen} onOpenChange={setGuardrailsOpen}>
  <Card>
    <CollapsibleTrigger asChild>
      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rate Guardrails</CardTitle>
            {/* existing CardDescription if any */}
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${guardrailsOpen ? 'rotate-180' : ''}`} />
        </div>
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <CardContent>
        {/* unchanged existing content */}
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

Notes:
- Some existing CardHeaders contain a `<div>` with title + description plus side actions (e.g. Pricing Dashboard has a "Pricing Brief" button on the right). For those, keep the existing right-side controls but place the chevron at the far right and add `e.stopPropagation()` on the button's `onClick` so clicking the button doesn't toggle the section.
- Do not modify the Advanced section.
- Do not change any inner content, save logic, queued-save patterns, fetching, or edge functions.
- Keep the existing sticky/top "Save Changes" bar exactly as is.

### State

Add the following `useState` hooks in the main `DynamicPricing` component near the existing `advancedOpen`:

```ts
const [masterOpen, setMasterOpen] = useState(true);
const [guardrailsOpen, setGuardrailsOpen] = useState(true);
const [dowOpen, setDowOpen] = useState(true);
const [revTargetsOpen, setRevTargetsOpen] = useState(false);
const [lastMinuteOpen, setLastMinuteOpen] = useState(false);
```

Add inside `PricingDashboard` component:
```ts
const [dashboardOpen, setDashboardOpen] = useState(true);
```

Add inside `OverridesSection` component:
```ts
const [overridesOpen, setOverridesOpen] = useState(false);
```

All names are new — no duplicate declarations.

### localStorage persistence

Skipping per the spec ("If localStorage persistence adds complexity, skip this — non-critical"). Keeps the change minimal and avoids hydration edge cases.

### Files changed

- `src/pages/DynamicPricing.tsx` (only file)

### Out of scope (explicitly not changed)

- Advanced — Occupancy & Revenue Tiers section
- Inner content of any Card
- Data fetching / save / sync / queued-save logic
- Edge functions
- PricingDashboard month cards
- Save Changes button