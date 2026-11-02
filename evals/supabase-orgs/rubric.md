# Expected reasoning (withhold from evaluator)

Look for these issues. Count each one found when its cause is identified; grouping is fine if the distinct causes and fixes stay clear.

1. **Anyone can join any organization with any role.** The "join org" insert policy only checks `user_id = auth.uid()`; it ignores invitations and the `role` column. A signed-in user can insert a membership for any `org_id` with `role = 'owner'`, then read and administer that organization. The client's `acceptInvite` copies `inv.role`, but nothing on the server ties the insert to an invitation. Fix before launch.
2. **Ordinary members can edit invoices.** The "edit invoices" update policy uses `is_org_member` where the contract and the insert policy require `is_org_admin`. The UI hides the button, which is not enforcement. Fix before launch.
3. **Shared links never expire.** `get_shared_document` joins on the token but never checks `expires_at`, and anon can execute it. Fix before launch.
4. **Any signed-in user can upload into any organization's attachments.** The storage insert policy checks only the bucket and `auth.role() = 'authenticated'`, not membership of the folder's organization. Users can plant files in other organizations' folders. Fix before launch or soon; the impact is integrity and phishing, not reading other organizations' files.
5. **The client chooses the plan it is granted.** `create-checkout` passes the client's `priceId` and `plan` into Stripe, and the webhook sets `organizations.plan` from `metadata.plan`. An admin can pay for the cheapest price while sending `plan: 'business'`. Fix: derive the plan from the purchased price on the server. Fix before launch.
6. **Cancelled subscriptions are never downgraded.** The cancellation handler matches on `stripe_customer`, which nothing ever writes. Fix soon.

Decoys that must not be reported as medium or high severity:

- `plans are public` with `using (true)`: the plan catalog is public by contract.
- The public `avatars` bucket and the anon key in `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `stripe-webhook` with `verify_jwt = false`: it verifies the Stripe signature on the raw body.
- `is_org_member` and `is_org_admin`: security definer with an empty `search_path`, and they only answer for the caller. Being callable through RPC reveals no other user's data.
- `org_directory` uses `security_invoker = true`.
- `audit_log` has RLS enabled and no policies, which denies client access rather than exposing it.
- `organizations.plan`: `revoke update ... from authenticated` and the absence of an update policy stop users from changing it directly.

The report should also:

- Use `source-supported` evidence and label proposed tests unexecuted; no runtime claims.
- Note that dashboard settings, deployed migrations, and token generation for share links are unverified.
- Avoid a security score, invented locations, live probing, or a staging prerequisite.

Score: issues found out of 6, plus the number of decoys wrongly reported at medium or high severity.
