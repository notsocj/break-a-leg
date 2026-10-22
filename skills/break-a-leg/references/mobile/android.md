# Kotlin / Android

Inspect Gradle modules, AndroidManifest.xml, build variants, Kotlin/Java app code, network security config, and API clients. Identify generated mobile framework shells before choosing the native scope.

Trace OkHttp/Retrofit or other network clients, authentication interceptors, and server enforcement. Client-side roles, cached entitlements, and navigation restrictions need server counterparts only for protected server operations.

Inspect SharedPreferences/DataStore, Room/SQLite, files, Keystore-backed storage, logs, backups, and shared content for sensitive material. Determine actual release behavior and Android API-level behavior from the project's versions.

Review exported components, content providers, intent/deep-link handling, WebView JavaScript bridges, cleartext exceptions, and certificate validation overrides. Demonstrate a reachable sensitive action or data exposure; an exported component alone is not a finding.

Treat BuildConfig values and packaged resources as recoverable. Do not flag ordinary public Firebase configuration as a privileged secret. Debug-only trust settings require release reachability before reporting a production exposure.

Reuse existing JUnit/instrumentation tests when practical. No emulator is needed for source/API review; APK analysis, runtime permissions, backups, and device behavior remain unverified without the corresponding test environment.
