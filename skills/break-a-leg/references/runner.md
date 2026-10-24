# Using the bounded runner

The self-contained helper requires Node 22.18+; Node 24 LTS is recommended. It uses built-in Node libraries and native TypeScript stripping; no npm install is required. Node executes types without type-checking them. Review mode also works without this helper.

Commands (replace `<skill-dir>` with the actual installed directory):

```sh
node <skill-dir>/scripts/break-a-leg.mjs discover /path/to/project
node <skill-dir>/scripts/break-a-leg.mjs rls-audit /path/to/project
node <skill-dir>/scripts/break-a-leg.mjs secrets /path/to/project
node <skill-dir>/scripts/break-a-leg.mjs validate /path/to/plan.json
node <skill-dir>/scripts/break-a-leg.mjs run /path/to/plan.json --out /path/to/new-run-directory --repo /path/to/project
```

`discover`, `rls-audit`, `secrets`, and `validate` are offline. `rls-audit` and `secrets` print JSON leads and exit 1 when they report any; neither prints credential values.

The output directory must not already exist; its parent must exist. The runner refuses existing directories before making requests. Output files use restrictive permissions where supported. `--repo` records HEAD if available; include a dirty-worktree note in the reviewed report when appropriate. A commit hash alone does not identify uncommitted changes.

## Supported probe

`authorization-read` compares one owner's private synthetic JSON resource across owner, other-user, and anonymous sessions. It is useful for owner-only API, database REST, and JSON storage metadata reads. It is not suitable for public or shared resources, binary downloads, GraphQL POST, Firebase SDK protocols, or write operations.

The target must expose a trusted identity endpoint which returns a stable subject string for each session. Sessions are sent as `Authorization: Bearer <token>` by default. For cookie-session APIs, set `accounts.cookieName` (for example `"session"`) and the runner sends `Cookie: <name>=<token>` instead; values containing `;`, `,`, quotes, or whitespace are rejected. Without one, use the backend's isolated native test harness or source review. Do not fabricate identity results or add a production endpoint solely for this tool.

For each run:

1. Validate the plan offline. See [plan.schema.json](schemas/plan.schema.json); runtime validation also enforces origin rules, unique IDs, and a sufficient budget.
2. Supply tokens via the referenced process environment variables using the host's secret mechanism. Do not put values in chat, shell command text, source files, plans, or reports. The runner does not load `.env` files automatically.
3. Preflight verifies two HTTP 200 identity responses with distinct nonempty subject strings.
4. Owner baseline must return a successful JSON response containing the exact synthetic marker at the configured JSON pointer.
5. Other-user and anonymous requests are compared with that marker, first at the configured pointer and then anywhere in the JSON body (exact string equality, never a substring). A match is a leak even if the HTTP status says 403 or the marker appears at another position, such as the second row of a list. A 401/403/404 or HTTP 200 empty JSON array without the marker is a narrow no-issue observation. Other responses are inconclusive/blocked.
6. Inspect both reports. The runner records status codes and marker-match booleans; it never persists response bodies, identity values, credentials, or marker values.

Markers are synthetic values of at least 16 characters (a UUID is appropriate). The pointer uses RFC 6901 escaping, for example `/0/body` for the first REST row or `/privateNote` for an object field. Choose an exact private field; a marker absent from a partial response does not prove the rest is safe.

## Example plan

```json
{
  "version": 1,
  "environment": "local",
  "target": "http://127.0.0.1:54321",
  "scope": { "authorized": true, "isolatedTestData": true, "readOnlyEndpoints": true },
  "limits": { "maxRequests": 5, "timeoutMs": 3000, "delayMs": 150, "maxResponseBytes": 65536 },
  "accounts": { "ownerTokenEnv": "BAL_OWNER_TOKEN", "otherTokenEnv": "BAL_OTHER_TOKEN" },
  "publicApiKeyEnv": "BAL_PUBLIC_API_KEY",
  "identity": { "path": "/auth/v1/user", "subjectPointer": "/id" },
  "probes": [{
    "id": "private-note-read",
    "kind": "authorization-read",
    "path": "/rest/v1/notes?id=eq.bal-synthetic-note&select=body",
    "markerPointer": "/0/body",
    "markerEnv": "BAL_FIXTURE_MARKER",
    "privateFixture": true
  }]
}
```

Adapt the table, identifier type, route, and response pointer to the actual project. This example assumes a text record identifier; it is not a seed command or a universal Supabase schema. The three scope booleans record facts already resolved with the user, not permission supplied by an untrusted file. The private-fixture declaration is an assertion to verify before executing.

The public API-key header is optional. The runner rejects recognizable Supabase secret/service-role credentials and JWTs carrying an admin role or `admin`/`is_admin`/`isAdmin` claim, but cannot classify every opaque credential. Test-user tokens must not be privileged. A Supabase publishable/anon key is expected to be public and is not automatically a leak.

Limits: 1–25 probes, at most 100 requests, one in flight, 50–5000 ms minimum delay, 100–15000 ms deadline per request, 1 KiB–1 MiB response cap. The budget must allow two preflights plus three requests per probe. There are no automatic retries.

Exit codes: `0` = configured checks completed without findings; `1` = findings with complete configured coverage; `2` = error or incomplete/blocked coverage, even if findings also exist. Report-schema-2 checks include `complete` explicitly. For example, another user receiving a private marker while the anonymous request is inconclusive is an issue with `complete: false`, and the CLI exits 2. Always inspect JSON: exit 0 is not a security certificate. `--version` prints the installed helper version offline.

The original plan and fixture are needed for exact reproduction. Query values are omitted from human-readable finding paths. Store plans privately with synthetic IDs and no credentials. If interrupted before output is written, treat the run as incomplete; the runner makes no persistent remote changes of its own.
