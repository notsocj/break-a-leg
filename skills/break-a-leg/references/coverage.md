# v0.1 coverage contract

| Capability | Implementation | Verification requirement |
| --- | --- | --- |
| Stack discovery | Offline helper plus agent inspection | Manifest hints are not a full inventory |
| Flutter, React Native/Expo, Swift/iOS, Kotlin/Android source review | Dedicated guides | Agent must trace actual reachable code |
| Other mobile frameworks | Generic guide | State missing framework-specific coverage |
| Supabase | Policy review and generic REST probe | Actual schema, normal JWT sessions, private seeded fixture |
| Firebase | Rules review and emulator test procedure | Project's Firebase SDK/test harness required; no built-in Firebase runtime adapter |
| Custom REST API reads | Generic bounded runner | Bearer sessions, trusted identity endpoint, JSON private marker |
| Ownership authorization reads | Automated runtime probe | Owner baseline and two distinct identities |
| Secret/storage/validation/entitlement checks | Agent-guided source analysis and project tests | No claim of automatic exhaustive scanning |
| Local app lock, lifecycle overlays, backup, deletion | Dedicated guide plus isolated project tests | Name mocked platform boundaries; widget tests are not native-device verification |
| Write authorization, subscription sandbox, uploads | Project-specific isolated tests | Record scope, evidence, setup and cleanup; otherwise untested |
| Device UI, binary analysis, jailbreak/tamper resistance | Not bundled | Mark skipped unless separately requested and available |
| Production active testing, password guessing, load testing | Outside v0.1 | Do not run |

Do not present reference availability as equivalent to an end-to-end tested platform integration. The included mobile fixtures are source snippets/manifests, not complete apps. Local generic HTTP integration tests validate the runner; they do not certify Supabase, Firebase, Flutter, iOS, or Android deployments.

Use OWASP categories to organize findings, not to assert compliance. Useful upstream references:

- [OWASP MASVS](https://mas.owasp.org/MASVS/): mobile controls.
- [OWASP MASTG](https://mas.owasp.org/MASTG/): mobile test procedures.
- [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/): backend testing.

When installed APIs, rules syntax, or SDK behavior matter, check the project's versions and upstream documentation. Do not silently upgrade dependencies to make a test work.
