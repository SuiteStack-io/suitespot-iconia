

## Plan: Save/Cancel Behavior for Passport Upload Dialog

### Goal
1. Change "Done" button text to "Save"
2. Implement cancel behavior: when clicking "Cancel" OR closing the dialog (X button) without clicking "Save", delete any newly uploaded passports from both storage and database

### Current State
The dialog already has:
- `newlyUploadedIds` state to track uploads during this session (line 37)
- `handleCancel` function that deletes newly uploaded passports (lines 206-223)

**Problem**: The X button and backdrop click use `onOpenChange` directly, which doesn't trigger the cleanup logic.

---

### Technical Changes

#### File: `src/components/PassportUploadDialog.tsx`

**1. Change "Done" to "Save" (line 311-313)**

```tsx
// Before
<Button onClick={() => onOpenChange(false)}>
  Done
</Button>

// After
<Button onClick={() => onOpenChange(false)}>
  Save
</Button>
```

**2. Intercept the dialog's onOpenChange to handle X button and backdrop clicks (line 226)**

Replace the Dialog's `onOpenChange` to use the cancel logic when closing without saving:

```tsx
// Before
<Dialog open={open} onOpenChange={onOpenChange}>

// After
<Dialog open={open} onOpenChange={(isOpen) => {
  if (!isOpen) {
    // User clicked X or backdrop - treat as cancel
    handleCancel();
  } else {
    onOpenChange(isOpen);
  }
}}>
```

**3. Update the Save button to NOT delete newly uploaded files**

The Save button should just close the dialog without deleting anything:

```tsx
<Button onClick={() => {
  setNewlyUploadedIds([]); // Clear tracking - these are now "saved"
  onOpenChange(false);
}}>
  Save
</Button>
```

---

### Behavior Summary

| Action | Result |
|--------|--------|
| Click "Save" | Keep all uploads, close dialog |
| Click "Cancel" | Delete newly uploaded passports, close dialog |
| Click X button | Delete newly uploaded passports, close dialog |
| Click backdrop | Delete newly uploaded passports, close dialog |
| Reopen dialog | Only previously saved passports are displayed |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/PassportUploadDialog.tsx` | Change "Done" to "Save", intercept onOpenChange to use handleCancel for unsaved closures, update Save button to clear tracking |

