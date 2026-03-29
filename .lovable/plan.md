

## Change Default Status Filter to "Confirmed"

### Change
**File**: `src/components/ReservationsList.tsx`, line 133

Change:
```ts
const [statusFilter, setStatusFilter] = useState<string>('all');
```
To:
```ts
const [statusFilter, setStatusFilter] = useState<string>('confirmed');
```

Single line change. Everything else stays the same.

