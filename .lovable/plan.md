

## Plan: Update Guest Forms Page Actions Column

### Goal
1. Remove the Preview (eye icon) button from the Actions column
2. Add a Passport upload button with the same functionality and design as in the Check-In page
3. Keep only the Download button for PDF

---

### Technical Changes

#### File: `src/pages/GuestForms.tsx`

**1. Add PassportUploadDialog import (line ~17)**

```tsx
import { PassportUploadDialog } from '@/components/PassportUploadDialog';
```

**2. Add BookOpen/Passport icon import from lucide-react (line ~57)**

Replace the Eye icon with BookOpen (passport-like icon):
```tsx
import {
  FileCheck,
  FileX,
  Mail,
  Files,
  Download,
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  BookOpen,  // Add this - passport icon
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
```

**3. Add state for passport dialog (around line ~108)**

```tsx
const [passportDialogOpen, setPassportDialogOpen] = useState(false);
const [passportReservation, setPassportReservation] = useState<{ id: string; guestName: string } | null>(null);
```

**4. Update the Actions column in the table (lines ~726-748)**

Remove the Preview button and add a Passport upload button:

From:
```tsx
<TableCell className="text-right">
  {hasForm && agreement && (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handlePreviewPDF(reservation, agreement)}
        disabled={previewingId === reservation.id}
        title="Preview in new tab"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDownloadPDF(reservation, agreement)}
        disabled={downloadingId === reservation.id}
        title="Download PDF"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )}
</TableCell>
```

To:
```tsx
<TableCell className="text-right">
  <div className="flex items-center justify-end gap-1">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setPassportReservation({
          id: reservation.id,
          guestName: agreement?.guest_full_name || reservation.guest_names?.[0] || 'Guest'
        });
        setPassportDialogOpen(true);
      }}
      title="Upload Passports"
    >
      <BookOpen className="h-4 w-4" />
    </Button>
    {hasForm && agreement && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDownloadPDF(reservation, agreement)}
        disabled={downloadingId === reservation.id}
        title="Download PDF"
      >
        <Download className="h-4 w-4" />
      </Button>
    )}
  </div>
</TableCell>
```

**5. Add PassportUploadDialog component before closing the main div (around line ~800)**

```tsx
<PassportUploadDialog
  open={passportDialogOpen}
  onOpenChange={setPassportDialogOpen}
  reservationId={passportReservation?.id || ''}
  guestName={passportReservation?.guestName || 'Guest'}
/>
```

**6. Remove unused previewingId state and handlePreviewPDF function**

Since the preview button is removed:
- Remove `const [previewingId, setPreviewingId] = useState<string | null>(null);` (line ~106)
- Remove the `handlePreviewPDF` function (lines ~319-355)

---

### Visual Result

| Before | After |
|--------|-------|
| Eye icon (Preview) + Download icon | BookOpen icon (Passport) + Download icon |
| Preview only shows for completed forms | Passport button shows for all rows |
| Download only shows for completed forms | Download still only shows for completed forms |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GuestForms.tsx` | Import PassportUploadDialog, add BookOpen icon, add passport dialog state, update Actions column, add PassportUploadDialog component, remove preview functionality |

---

### Dependencies

No new dependencies needed - using existing:
- `PassportUploadDialog` component already exists
- `BookOpen` icon from lucide-react (passport-like icon)

