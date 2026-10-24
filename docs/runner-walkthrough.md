# Runner walkthrough

The helper supports one active probe: an owner-only JSON read checked with two distinct ordinary users and an anonymous caller. It is not a general mobile scanner. For Flutter widget tests, Firebase SDK rules tests, writes, uploads, or binary files, use the app's isolated test harness and the skill's relevant guide.

## Try the runnable synthetic demo

From the BreakALeg repository, with Node 22.18+ available:

```sh
npm run demo
```

No `npm install`, app project, real credentials, or external service is needed. The demo creates temporary loopback servers and synthetic identities, then closes the servers. The execution environment must permit local port binding.

Expected output includes:

```text
vulnerable: issue-found; 5 requests; 2 findings
secure: no-issue-observed; 5 requests; 0 findings
```

Reports appear in a new `.break-a-leg/demo/<run-id>/` directory. A successful demo exits 0 because both fixtures behaved as expected, including the intentionally vulnerable one. That differs from the ordinary `run` command's finding exit code.

## Discover your app offline

From the BreakALeg checkout:

```sh
node skills/break-a-leg/scripts/break-a-leg.mjs --version
node skills/break-a-leg/scripts/break-a-leg.mjs discover /path/to/your-app
node skills/break-a-leg/scripts/break-a-leg.mjs secrets /path/to/your-app
node skills/break-a-leg/scripts/break-a-leg.mjs rls-audit /path/to/your-app
```

`secrets` lists likely credentials by type, file, line, and an exposure hint such as `client-bundled-variable`, without ever printing the value. Supabase anon/publishable keys and Firebase client keys are counted as public, not reported. `rls-audit` looks for `supabase/` folders, replays their migrations and `config.toml`, and lists leads such as tables without RLS, `using (true)` policies, views that bypass RLS, public buckets, and Edge Functions without JWT verification. Both print JSON and exit 1 when they have something for you to review. Leads are places to look, not confirmed vulnerabilities.

Discovery returns candidate stacks and file paths, `suggestedChecks` (guides worth reading because of payment, AI, local-storage, or sign-in dependencies), plus truncation and unreadable-entry information. It does not identify vulnerabilities, verify a runnable app, read all source, or contact endpoints. Flutter's generated Android/iOS directories can produce multiple stack signals for one app.

## Prepare a real local/staging read test

Begin with source review and a known isolated target. Verify the endpoint really performs a read: HTTP GET alone does not guarantee absence of side effects.

You need:

- A loopback HTTP(S) origin for local mode, or an HTTPS staging origin.
- Two distinct ordinary test users and a trusted identity endpoint returning stable subject IDs.
- A synthetic record private to the owner, with no sharing relationship to the second user.
- A unique synthetic marker, at least 16 characters long, at a known JSON pointer in the owner response.
- A cleanup plan for any separately created accounts/records. The runner does not seed or delete them.

Choose an example:

| Example | Assumptions to replace |
| --- | --- |
| [Generic local API](../examples/local-api.plan.json) | `/me` returns `{ "id": "…" }`; the private note returns `{ "body": "…" }` |
| [Supabase local](../examples/supabase-local.plan.json) | Local URL, real table and ID type, ordinary user JWTs, public API key, and selected-row response shape |
| [HTTPS staging](../examples/staging.plan.json) | Placeholder host, endpoint paths, verified isolation, identities, and fixture |

The files are templates, not running services or database seed scripts. The generic example's port 8787 is not a server started by `discover` or `validate`. Do not deploy an identity endpoint merely to satisfy this tool.

Create a private working plan from an example, then edit it for your environment. The following commands run from the BreakALeg checkout:

```sh
mkdir -p .break-a-leg
cp examples/local-api.plan.json .break-a-leg/plan.json
```

The `scope` booleans record facts you already established. Setting them to `true` does not establish permission, ownership, or isolation.

## Supply credentials without placing them in the plan

The example uses these process-environment references:

| Name | Value supplied by your secret mechanism |
| --- | --- |
| `BAL_OWNER_TOKEN` | Ordinary fixture owner's bearer session |
| `BAL_OTHER_TOKEN` | Different ordinary user's bearer session |
| `BAL_FIXTURE_MARKER` | Synthetic value placed in the private record |
| `BAL_PUBLIC_API_KEY` | Optional public/publishable API key when required by the selected plan |

Have your local secret manager or execution environment supply the named variables to the process. The runner does not load `.env` files. Do not put values in commands, chat, screenshots, or committed plans. Admin/service credentials invalidate an ordinary-user access test even if an opaque credential passes syntactic checks.

## Validate, run, and inspect

After adapting the plan, validate it offline:

```sh
node skills/break-a-leg/scripts/break-a-leg.mjs validate .break-a-leg/plan.json
```

Validation does not read credentials, send requests, or prove that your fixture is correctly owned. Once scope and environment are resolved and variables are supplied, execute the run:

```sh
node skills/break-a-leg/scripts/break-a-leg.mjs run .break-a-leg/plan.json --out .break-a-leg/run-001 --repo /path/to/your-app
```

The output directory must be new and its parent must exist. Choose a fresh name for another run. `--repo` records the app's HEAD when available; document uncommitted changes separately.

For one probe, the normal sequence is two identity requests, one successful owner baseline, one other-user request, and one anonymous request. The budget must cover `2 + 3 × probe count`. Requests are serial, bounded, and not retried; redirects are not followed. Transport failures, oversized responses, 429, and 5xx stop further requests.

The configured private marker appearing for an unauthorized caller is a finding, including inside a denial response. A missing marker in an ambiguous response is not proof of safety. Inspect both `report.json` and `report.md`, including `complete`, before interpreting the exit code.

See the [full runner reference](../skills/break-a-leg/references/runner.md), [plan schema](../schemas/plan.schema.json), and [report interpretation](reports-and-troubleshooting.md). Do not broaden the target or use unbounded requests to work around a rejected plan.
