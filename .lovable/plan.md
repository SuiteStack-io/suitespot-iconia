

## Make Required Field Asterisk Red

### Change
In `src/pages/Rooms.tsx`, replace the plain text `"Room Name *"` label with JSX that renders the asterisk in red:

```tsx
<Label htmlFor="add-name">Room Name <span className="text-red-500">*</span></Label>
```

This is a single-line change on line 1479.

