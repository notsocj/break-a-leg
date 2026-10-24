# AI features

Use this guide when the app calls an LLM or other AI provider (OpenAI, Anthropic, Gemini, Vercel AI SDK, LangChain). The usual risks are a leaked provider key, unbounded cost, and model output acting with more access than the user has.

## Keys and cost

- A provider key in the mobile app, a public env variable, or bundled config lets anyone spend the founder's quota. Run `secrets` and trace the call: the provider must be called from a server the founder controls.
- A server proxy without authentication, or with authentication but no per-user limit, is the same problem one step removed. Check for per-user quotas, maximum input/output tokens, and model choice fixed on the server rather than taken from the request.
- Free-tier or trial limits counted on the device can be reset by reinstalling. See [paid-features.md](paid-features.md).

## Prompt injection and tools

Treat any text the model reads that the user did not write as untrusted: other users' content, documents, web pages, emails, and tool results.

- If the model can call tools (database queries, sending messages, payments, file access), check that each tool call is authorized as the **end user**, not with a service-role or admin client. Injected text must not be able to read or change another user's data through a tool.
- System prompts are not secret and not an access control. Do not report "the system prompt can be extracted" as a vulnerability unless the prompt contains credentials or private data.
- Model output rendered as HTML or Markdown in a WebView can carry links or scripts; check sanitization at the rendering layer. Output used in SQL, shell, or file paths needs the same treatment as any untrusted input (see [validation.md](validation.md)).

## Data handling

Check what user data is sent to the provider, whether that matches the privacy policy and App Store privacy labels, and whether prompts and responses are logged with personal data. Report mismatches as privacy findings, separate from security exploits.

## Verification

Do not run cost or rate-limit stress tests against a live provider. A small, finite isolated test may confirm that an unauthenticated request is rejected or that a quota stops a second request. Label proposed injection tests as unexecuted unless run in an isolated environment with synthetic data.
