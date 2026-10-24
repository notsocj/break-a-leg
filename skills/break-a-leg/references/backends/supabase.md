# Supabase

Locate client initialization, project/environment selection, migrations, RLS policies, storage policies, SQL functions, and Edge Functions. Missing local migrations mean deployed state is unknown; do not infer deployed RLS from the mobile SDK configuration.

Distinguish publishable/legacy anon keys from secret/service-role credentials. Public client keys are expected; secret/service-role credentials bypass RLS and must not ship in clients. [Official data security guidance](https://supabase.com/docs/guides/database/secure-data).

Review table grants together with RLS enablement and applicable policies. Evaluate operation-specific rules: SELECT visibility, INSERT/UPDATE checks, ownership changes, memberships, and role updates. A permissive policy can combine with other permissive policies; finding one restrictive policy does not prove a table is protected. Review security-definer functions, views, RPCs, and server code that may bypass ordinary table policies.

For local verification, use the project's existing [local stack](https://supabase.com/docs/guides/local-development/cli/getting-started), migrations, and a disposable synthetic seed. Do not reset an existing developer database without explicit scope. Privileged setup credentials may seed fixtures, but remove them from the probe context. Probe with two ordinary authenticated users and an anonymous caller.

The bundled runner can use `/auth/v1/user` with `/id` for identity, a publishable/anon `apikey` header, and a table-specific REST GET returning a private marker. Confirm this matches the installed service. A 200 empty array can represent RLS filtering; the owner baseline must return the marker first. Missing grants, wrong filters, and stale tokens must not become security passes.

For writes, use project tests to attempt ownership transfer, cross-user updates, and prohibited role fields in a disposable backend. Record both the rejection and unchanged stored state. The bundled runner does not perform writes.

Storage: examine bucket visibility and object policies separately. A public bucket or intentionally shareable URL is only a finding when it violates the intended privacy rule. Never modify a production policy to make a test easier.

## High-yield patterns

Run `rls-audit` when local migrations exist; it lists these leads with file and line. Confirm each against the intended access rule before reporting it.

- A table in an exposed schema (`public` by default) with no `enable row level security` after all migrations. Supabase grants table access to `anon` and `authenticated`, so the Data API reaches every row.
- `using (true)` or `with check (true)` on rows that are private, per-user, or per-organization. Policies granted `to authenticated` also cover anonymous sign-ins when they are enabled.
- UPDATE policies without a `with check` that keeps `owner_id`, `role`, `credits`, or plan columns unchanged, letting users reassign rows or grant themselves privileges.
- Views without `security_invoker = true`, and materialized views, in exposed schemas: they read tables as their owner and bypass RLS.
- `security definer` functions in exposed schemas: callable through `/rest/v1/rpc` unless EXECUTE is revoked, and unsafe without a fixed `search_path`. Check that each verifies `auth.uid()` itself.
- Public storage buckets holding private files, and `storage.objects` policies that check only `bucket_id`.
- Edge Functions with `verify_jwt = false` that do not verify a webhook signature, or that read a user ID from the request body instead of the verified JWT. Functions using the service-role client must enforce authorization themselves.
- A service-role key anywhere in client code or `EXPO_PUBLIC_`/`NEXT_PUBLIC_` variables (run `secrets`).
