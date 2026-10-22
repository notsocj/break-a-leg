# Private local and remote storage

Separate local device storage from backend files. For local data, identify sensitivity, persistence, backups, logs, and who could access it under the stated threat. A preference containing a theme choice is not a finding; a refresh token in an unexpectedly exported log can be.

For remote storage, establish whether a file is intended to be private, shared, or public. Review bucket visibility, path/object ownership, upload rules, signed-link semantics, and application access checks. Unguessable names are not sufficient authorization for private data. Signed links may intentionally be bearer capabilities; assess their expiry and distribution in context.

Use synthetic small files and ordinary owner/other/anonymous identities in an isolated existing test harness. The bundled runner handles JSON metadata only, not binary downloads or uploads. A binary endpoint skipped by the helper must stay untested in coverage.

Test uploads only when explicitly included in the scoped run. Validate server-enforced size/type limits and paths with a bounded non-executable fixture. Track exactly which objects were created and delete only those. Never enumerate real users' files to prove exposure.
