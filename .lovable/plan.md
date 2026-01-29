

## Plan: Fix Passport View Error - Use Signed URLs for Private Bucket

### Problem
The `id-passports` storage bucket is **private** (not public), but the code is using `getPublicUrl()` to generate URLs. When users click "View", they get a "Bucket not found" error because public URLs don't work for private buckets.

### Solution
Change the approach to use **signed URLs** for viewing files from the private bucket. Instead of storing a public URL in the database, store only the file path and generate signed URLs on-demand when viewing.

---

### Technical Changes

#### File: `src/components/PassportUploadDialog.tsx`

**1. Update upload logic to store file path instead of public URL (lines 127-138)**

Change from storing `publicUrl` to storing just the file path:

```tsx
// Before
const { data: urlData } = supabase.storage
  .from('id-passports')
  .getPublicUrl(fileName);

const { data: insertedData, error: dbError } = await supabase
  .from('reservation_passports')
  .insert({
    reservation_id: reservationId,
    passport_url: urlData.publicUrl  // Stores full public URL (doesn't work)
  })
```

```tsx
// After - store the file path only
const { data: insertedData, error: dbError } = await supabase
  .from('reservation_passports')
  .insert({
    reservation_id: reservationId,
    passport_url: fileName  // Store just the file path
  })
```

**2. Add a function to generate signed URLs for viewing (new function)**

```tsx
const getSignedUrl = async (filePath: string): Promise<string | null> => {
  // Extract just the path if it's a full URL (for backwards compatibility)
  let path = filePath;
  if (filePath.includes('/id-passports/')) {
    path = filePath.split('/id-passports/').pop() || filePath;
  }
  
  const { data, error } = await supabase.storage
    .from('id-passports')
    .createSignedUrl(path, 3600); // 1 hour expiry
    
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data.signedUrl;
};
```

**3. Update the View link to use signed URLs (lines 237-244)**

Replace the direct link with a button that generates a signed URL on click:

```tsx
// Before
<a
  href={passport.passport_url}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs text-primary hover:underline mt-1"
>
  View
</a>

// After
<button
  onClick={async () => {
    const url = await getSignedUrl(passport.passport_url);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Failed to load passport');
    }
  }}
  className="text-xs text-primary hover:underline mt-1"
>
  View
</button>
```

**4. Update delete handler for backwards compatibility (lines 165-167)**

Ensure the delete handler works with both old full URLs and new file paths:

```tsx
// Already handles this with:
const urlParts = passport.passport_url.split('/id-passports/');
const filePath = urlParts[urlParts.length - 1];
// This works for both full URLs and file paths
```

---

### Why Signed URLs?

| Approach | Pros | Cons |
|----------|------|------|
| Public bucket | Simple URLs work directly | Anyone with URL can access passports - security risk! |
| Signed URLs | Secure - temporary access only | Requires generating URL on each view |

Passports contain sensitive personal information, so keeping the bucket private with signed URLs is the correct security approach.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/PassportUploadDialog.tsx` | Store file path instead of public URL, add `getSignedUrl` function, update View button to use signed URLs |

---

### Backwards Compatibility

The solution handles existing records that have full public URLs stored by extracting the file path from them. New uploads will store only the file path.

