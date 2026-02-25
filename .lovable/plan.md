

## Fix: Message Log New Tab / 404 Bug (Persistent Issue)

### What I Found

After thorough investigation, I identified two concrete issues and one environmental factor:

1. **Redundant auth redirect in MessageLog.tsx** (line 39-41): The page has its own `useEffect(() => { if (!loading && !user) navigate('/auth'); })` even though it's already wrapped in `<ProtectedRoute>`. This creates a race condition where both the page and the route guard compete to redirect, which can cause double navigation.

2. **Missing `SheetTitle` in SheetContent** (sheet.tsx): The Sheet component (built on Radix Dialog) is missing a required `DialogTitle`, as confirmed by console errors. This causes Radix to emit warnings and can interfere with focus management and event handling when the sheet opens/closes, potentially causing click events to propagate incorrectly.

3. **Stale PWA service worker**: The project uses `vite-plugin-pwa` with `registerType: "autoUpdate"`. A cached service worker from a previous build may be intercepting the `/message-log` navigation and serving a stale response that doesn't include this route, resulting in a 404. This would also explain why the issue persists across sidebar opens.

### Changes

**File: `src/pages/MessageLog.tsx`**
- Remove the redundant `useEffect` auth redirect (lines 39-41). The `<ProtectedRoute>` wrapper already handles this.
- Remove the early return `if (!user) return null;` (line 101) since ProtectedRoute already prevents rendering without auth.

**File: `src/components/ui/sheet.tsx`**
- Add a visually hidden `SheetTitle` inside `SheetContent` to satisfy the Radix Dialog accessibility requirement and prevent the console error that may be disrupting event handling.
- Add `aria-describedby={undefined}` to suppress the missing description warning.

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/MessageLog.tsx` | Remove redundant auth useEffect and early return |
| `src/components/ui/sheet.tsx` | Add hidden SheetTitle + aria-describedby to SheetContent |

### Post-Fix Testing
After applying these changes:
1. Hard-refresh the browser (Ctrl+Shift+R) to clear any cached service worker
2. Open sidebar → click Message Log → should navigate in the same tab, no new tab
3. Open/close sidebar repeatedly on the Message Log page → no new tabs should appear
4. Verify other sidebar items still work correctly

