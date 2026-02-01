

## Add Select All Toggle to Edit Permissions Dialog

### Summary
Add a "Select All" toggle switch at the top of the permissions list in the Edit Permissions dialog. This allows admins to quickly enable or disable all permissions at once.

---

### Technical Changes

**File:** `src/components/EditPermissionsDialog.tsx`

#### 1. Add computed state for "all selected" (after line 77)

```typescript
const allPermissionsEnabled = Object.values(permissions).every(Boolean);
```

#### 2. Add toggle all handler (after fetchPermissions function, around line 110)

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

#### 3. Add Select All row above permissions list (Line 159, inside the permissions div)

```tsx
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
```

---

### Result

| Action | Result |
|--------|--------|
| Toggle "Select All" ON | All 7 permissions become enabled |
| Toggle "Select All" OFF | All 7 permissions become disabled |
| Any individual permission OFF | "Select All" toggle shows OFF |
| All individual permissions ON | "Select All" toggle shows ON |

