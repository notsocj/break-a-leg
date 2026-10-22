# Flutter / Dart

Find `pubspec.yaml`, `lib/`, build flavors, `--dart-define` inputs, asset declarations, and native platform folders. Use the project's installed package versions. Generated platform folders identify packaging, not separate native business logic.

Trace HTTP/Dio, Supabase, and Firebase calls from repositories/services to their backend enforcement. Provider/Riverpod/BLoC state and route guards are UI decisions, not authorization. Check whether fields such as `owner_id`, `role`, `credits`, or `isPremium` come from mutable client state and whether the server independently verifies them.

Inspect sensitive data written through SharedPreferences, Hive, SQLite, files, logs, and crash reporting. Verify the actual storage implementation and threat before recommending Keychain/Keystore-backed storage. Do not assume every local database needs encryption or every preference is sensitive.

Treat Dart constants, assets, `.env` assets, and dart-define values shipped in the app as recoverable by users. Public Firebase config/Supabase publishable keys are not secrets by themselves. Trace a suspected privileged key to an included build path before reporting exposure.

Review `HttpOverrides`, certificate callbacks, WebViews, deep links, and broad platform network exceptions in the release configuration. Debug-only exceptions are not automatically production findings. Check whether a deep link can invoke a sensitive action without a server authorization check.

Reuse existing `flutter test`/integration tests when needed and within scope. Do not require Flutter installation or a simulator for backend checks. If no release artifact is available, describe source reachability and mark binary exposure/device behavior unverified.
