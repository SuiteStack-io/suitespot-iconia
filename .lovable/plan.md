

## Remove the property-specific collapsible section from the slide menu

### What to change

**`src/components/SlideMenu.tsx`**:
- Delete the first menu section object (the one with `collapsible: true` that renders the property name label with Properties, KYC Management, KYC Results, Session Audit Log, Tickets Analytics)
- Remove the `almazaBayOpen` / `setAlmazaBayOpen` state
- Remove the collapsible rendering logic (the `if (isCollapsible && setOpen)` block and related variables `isOpen`, `setOpen`, `isCollapsible`)
- Remove unused imports: `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `ChevronDown`, `Mountain`, `ClipboardList`, `ScrollText`, `BarChart3`, `FileText` (if not used elsewhere in the same file)

The routes (`/almaza-bay`, `/kyc-management`, `/selection-sessions`, `/session-audit-log`, `/ticket-analytics`) will remain functional — they just won't appear in the menu. The pages and route definitions in `App.tsx` stay untouched.

### What stays the same
- All other menu sections (Operations, Front Desk, PMS, Management, Website, System)
- Property Switcher in the menu header
- All route definitions and page components

