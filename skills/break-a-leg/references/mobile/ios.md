# Swift / iOS

Inspect the relevant Xcode target, Swift package/app sources, release build configuration, entitlements, and Info.plist. Distinguish native iOS from a generated Flutter/React Native shell.

Trace URLSession/API clients, identity/session handling, and backend calls. An in-app role or StoreKit entitlement may drive UI; check how remote paid operations verify access. Do not require server verification for a purely local cosmetic feature without a corresponding threat.

Inspect UserDefaults, files, Core Data/SQLite, Keychain usage, logging, and exported/shared content for sensitive data. Evaluate accessibility, backups, and access groups in context; do not report all local storage as insecure.

Review broad ATS exceptions, server-trust overrides, WKWebView bridges, universal/custom links, and exported document/file behaviors where they reach sensitive operations. A missing pinning implementation or jailbreak detector is not a default finding for an ordinary founder app.

Read release configuration before concluding debug behavior ships. Reuse existing XCTest targets only when the environment is available. Source analysis and API probes do not verify the signed binary, Keychain behavior, App Store review status, or device runtime.
