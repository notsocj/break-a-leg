# Fixture scope

The mobile directories are minimal discovery/source-review snippets, not installable or buildable apps. Both Flutter and React Native call the same conceptual private-notes backend. Their client query alone neither proves nor fixes an authorization flaw.

The Supabase SQL and Firebase rules are alternative vulnerable/secure source fixtures. They have not been applied to a live service by the default test suite. Apply them only in a disposable, explicitly selected test environment. Firebase runtime tests must use ordinary authenticated/unauthenticated SDK contexts, not Admin SDK requests.

`tests/fixture-server.mjs` is the executable loopback API used by the automated tests and demo. It models the ownership boundary without requiring a real database. All tokens and marker values there are synthetic.
