# Credential exposure

Inspect client-included source/configuration, assets, build variables, and reachable logs for privileged credentials. Use filename-only searches first; avoid printing matching secret lines into tool output. Inspect only what is necessary and redact values immediately. Do not send suspected secrets to external validators.

Classify credentials by capability: public project identifier/publishable key, ordinary user session, private server credential, or ambiguous value. A recognizable prefix is a lead, not evidence of a live exploitable credential. Dummy fixtures, examples, public Firebase config, and Supabase publishable/anon keys are not automatically vulnerabilities.

Establish reachability: bundled code/assets, a release build input, or a log path that actually receives the value. A server-only environment variable in the repository does not establish client exposure. Record location and secret type without recording its value.

Recommend moving privileged operations behind a trusted server boundary and rotating genuinely exposed credentials through the user's normal process. Do not rotate or revoke credentials automatically. Obfuscation, renaming an environment variable, or moving it into client `.env` does not remove client exposure.

Report unknown validity as unknown. A source-supported exposure does not need a live credential test to be useful.
