# Firebase

Locate project IDs/config selection, Firestore/Realtime Database/Storage rules, indexes, Cloud Functions, and app SDK calls. Firebase client configuration/API keys are not administrative credentials by themselves. Service-account private keys and admin credentials require separate scrutiny.

Review rules per operation. Authentication alone does not establish document ownership. Check path variables, stored owner IDs, create/update field allowlists, ownership immutability, role/credit fields, and overlapping broader matches. Query rules are not a post-query filter; test the actual query shape used by the app.

Admin/server SDKs can bypass client rules. A passing Admin SDK request does not test a user's access. Review Cloud Functions' authorization separately, even when the database rules look restrictive. App Check is not a replacement for authorization.

For verification use the project's [Local Emulator Suite and rules tests](https://firebase.google.com/docs/rules/unit-tests), preferably a `demo-` project. Real-project emulator setups can still reach non-emulated resources: verify all services used by the test are emulated. [Firebase emulator setup guidance](https://firebase.google.com/docs/emulator-suite/connect_and_prototype).

Minimal finite test procedure using the project's installed test SDK:

1. Initialize an isolated demo test environment using the actual rules file and loopback emulator host.
2. Seed one private document/file as setup only, with rules disabled in that isolated setup context.
3. Create authenticated contexts for owner A and unrelated user B, plus an unauthenticated context.
4. Assert A can read the fixture. Assert B and the unauthenticated context cannot read it.
5. For an authorized write check, assert B cannot update/delete the fixture and A cannot modify protected ownership/role fields. Check stored state afterward.
6. Clear only the isolated test project's data and close the environment in `finally`; report cleanup failures.

Use actual `assertSucceeds`/`assertFails`-style assertions supported by the installed rules-test package. Never use an Admin SDK as the probed identity. Inspect the failing error: an unavailable emulator or invalid query is not proof that rules denied access.

The bundled generic HTTP runner is not a Firebase SDK/rules adapter. If the project lacks emulator tooling, continue source review and label proposed rules tests unexecuted. Do not pretend that the presence of this guide establishes Firebase integration coverage.
