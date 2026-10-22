# Other mobile frameworks

Locate the app entrypoint, dependency/build manifest, release configuration, client data storage, session handling, and backend call sites. Hybrid frameworks, .NET MAUI, Unity, Kotlin Multiplatform, and other stacks may share the same backend checks.

Use the framework's installed documentation and existing tests rather than assuming Flutter or React Native conventions. Distinguish native bridges from web content where relevant. Review generated configuration and actual build inclusion before treating a source string as a shipped secret.

Apply the shared authorization, validation, storage, secrets, and paid-operation guides. Report framework-specific/device coverage as unavailable when no adapter or tool exists. Never stop useful backend analysis solely because the mobile framework is unfamiliar.
