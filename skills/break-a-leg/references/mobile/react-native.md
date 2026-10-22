# React Native / Expo

Inspect `package.json`, app config, build profiles, native folders when present, and client API modules. Expo-generated native directories may be absent. Determine the selected build profile and backend origin without printing environment values.

Treat shipped JS bundles, `EXPO_PUBLIC_*` values, and client-accessible app configuration as public. Do not recommend moving a privileged secret into a client `.env` variable as a fix; it must move behind a trusted server boundary.

Trace AsyncStorage, SQLite/MMKV, SecureStore/Keychain wrappers, persisted state, logs, analytics, and crash reports for sensitive session or user data. Check behavior for the installed version rather than assuming a package name guarantees protection.

Client navigation, React state, feature flags, and local subscription booleans cannot authorize a backend operation. Follow the request through server validation/policies. Check deep-link handlers and WebView message bridges for access to sensitive operations; do not label their mere presence a vulnerability.

Reuse the project's Jest or other tests for source-level regressions and backend tests for access boundaries. No browser automation can establish native device coverage. Report simulator/device checks separately and do not install Expo tooling solely for a source review.
