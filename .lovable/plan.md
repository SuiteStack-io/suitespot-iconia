## Plan: Temporary `get-service-key` edge function

Create a one-off admin-only edge function that returns `SUPABASE_SERVICE_ROLE_KEY` as plain text so you can copy it into the new project, then delete the function.

### Behavior
- Path: `supabase/functions/get-service-key/index.ts`
- Method: `GET` (with OPTIONS for CORS)
- Auth: Requires `Authorization: Bearer <user JWT>`. Verifies the caller via `auth.getUser()` and checks `user_roles` for `admin` or `super_admin`. Anyone else → 403.
- Response: `text/plain` body containing the raw service role key value. No JSON wrapper.
- Logs: No logging of the key value.

### Security notes (acknowledging the risk)
- The service role key bypasses RLS — anyone holding it has full DB access.
- This function will exist for minutes only. After you copy the value:
  1. Reply "delete it" and I'll remove the function and undeploy it.
  2. Strongly recommend rotating the service role key in the **old** project once migration is complete (Lovable Cloud → rotate keys), since the value will have passed through chat/network.

### Steps
1. Write `supabase/functions/get-service-key/index.ts` with the admin gate.
2. Deploy via `supabase--deploy_edge_functions`.
3. Call it via `supabase--curl_edge_functions` with your admin JWT and return the key value to you.
4. Wait for your "delete it" confirmation, then `rm -rf` the folder and call `supabase--delete_edge_functions`.

Approve to proceed.