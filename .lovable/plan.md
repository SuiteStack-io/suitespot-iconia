
## Add Select All Toggle to Edit Permissions Dialog

### Summary
Add a "Select All" toggle switch at the top right of the permissions list in the Edit Permissions dialog. This allows admins to quickly enable or disable all permissions at once.

---

### Technical Changes

**File:** `src/components/EditPermissionsDialog.tsx`

#### 1. Add computed state for "all selected"

```typescript
// Compute whether all permissions are currently enabled
const allPermissionsEnabled = Object.values(permissions).every(Boolean);
```

#### 2. Add toggle all handler

```typescript
const handleToggleAll = () => {
  const newValue = !allPermissionsEnabled;
  setPermissions({
    can_check_in: newValue,
    can_check_out: newValue,
    can_submit_forms: newValue,
    can_create_booking: newValue,
    can_change_rooms: newValue,
    can_block_dates: newValue,
    can_export_calendar: newValue,
  });
};
```

#### 3. Add Select All row above permissions list (Line ~224)

```tsx
<div className="space-y-4 py-4">
  {/* Select All toggle row */}
  <div className="flex items-center justify-between py-2 border-b">
    <div className="space-y-0.5 pr-4">
      <Label htmlFor="select-all" className="font-medium cursor-pointer">
        Select All
      </Label>
      <p className="text-xs text-muted-foreground">
        Toggle all permissions at once
      </p>
    </div>
    <Switch
      id="select-all"
      checked={allPermissionsEnabled}
      onCheckedChange={handleToggleAll}
    />
  </div>
  
  {/* Individual permission toggles */}
  {(Object.keys(PERMISSION_LABELS) as Array<keyof UserPermissions>).map((key) => (
    // ... existing permission rows
  ))}
</div>
```

---

### Result

```text
┌────────────────────────────────────────────┐
│  Edit Permissions                      [X] │
│  Dina Mamdouh  [Front_desk]                │
├────────────────────────────────────────────┤
│                                            │
│  Select All                   [====ON====] │  <-- NEW
│  Toggle all permissions at once            │
│  ─────────────────────────────────────────  │
│  Check In Guests              [====ON====] │
│  Check Out Guests             [====ON====] │
│  Complete Guest Forms         [====ON====] │
│  Create Manual Booking        [====ON====] │
│  Change Rooms                 [====ON====] │
│  Block Calendar Dates         [====ON====] │
│  Export Calendar              [====ON====] │
│                                            │
├────────────────────────────────────────────┤
│                        [Cancel] [  Save  ] │
└────────────────────────────────────────────┘
```

---

### Behavior

| Action | Result |
|--------|--------|
| Toggle "Select All" ON | All 7 permissions become enabled |
| Toggle "Select All" OFF | All 7 permissions become disabled |
| Any individual permission OFF | "Select All" toggle shows OFF |
| All individual permissions ON | "Select All" toggle shows ON |

The toggle state is computed dynamically based on whether all permissions are currently enabled.
