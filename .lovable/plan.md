

## Part A: Manual Room Assignment Fix

### Current State (wrong assignments)
| Guest | Check-in | Currently on | Should be on |
|---|---|---|---|
| Anton Yang | Apr 1–4 | Room 502 | Room 505 |
| Emna Haj Romdhane | Apr 3–5 | Room 505 | Room 501 |
| Alejandro Quiros | Apr 3–6 | Room 501 | Room 502 |

### Data Updates (3 SQL statements via insert tool)
```sql
-- Anton Yang → Room 505
UPDATE reservations SET unit_id = '3ca13973-c38c-4084-9a7a-f390cf20ee55'
WHERE id = '0b435855-30ca-4250-a68d-a100f4028c07';

-- Emna Haj Romdhane → Room 501
UPDATE reservations SET unit_id = 'daf2ed4d-e7ec-4b4b-a709-7323aac2f6ed'
WHERE id = '004f4960-8396-45fe-9312-f032cb4ced20';

-- Alejandro Quiros → Room 502
UPDATE reservations SET unit_id = 'bc577e59-03cb-4b1b-ba79-807afdaae977'
WHERE id = 'afd8dfa2-1f72-4958-bace-d7e4043d20be';
```

### Note on Part B
The title mentions "Algorithm Upgrade" but no details were provided. After applying Part A, let me know what changes you want to the shuffle algorithm.

### No code changes needed
This is a data-only fix — 3 reservation rows updated to the correct `unit_id`.

