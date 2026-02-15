

## Delete Almaza Bay Unit Only

### What Will Be Deleted
| Table | Records | Action |
|-------|---------|--------|
| `units` | 1 record ("Residences Chalet with Pool", id: aa68ee27-2f8e-4e6f-9f67-a801254493a3) | DELETE |

### What Will Be Kept
- `kyc_links` (9 records) -- kept
- `selection_accounts` (7 records) -- kept
- `guest_inventory_access` (7 records) -- kept
- `audit_logs` (session audit log) -- kept
- All other tables -- untouched

### SQL Statement

```text
DELETE FROM units WHERE id = 'aa68ee27-2f8e-4e6f-9f67-a801254493a3';
```

### Note
If the `guest_inventory_access` table has a foreign key constraint referencing this unit, the delete may fail. In that case, we will first remove only the `guest_inventory_access` rows that reference this specific unit, then delete the unit.

