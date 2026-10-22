# Server-side validation

Choose fields tied to sensitive behavior: owner/tenant IDs, quantities, prices, URLs, filenames, rich text, and query parameters. Trace the client field to the server validator, domain logic, and final sink. UI-only constraints are a hypothesis until the backend is inspected.

Use small, representative boundary cases in existing isolated tests: missing required field, wrong type, out-of-range number, duplicate operation, or unauthorized protected field. Avoid broad fuzzing, oversized payloads, expensive regular-expression probes, and destructive injection payloads in v0.1.

Confirm a security consequence such as unauthorized state change, unsafe rendering in a reachable WebView, or unsafe SQL construction. A validation error, harmless unusual input, or a crash in an isolated test is not automatically a data breach. Report robustness issues separately when relevant.

For injection candidates, establish untrusted input reaching an unsafe sink and check parameterization/escaping at the correct layer. Never recommend only client sanitization. URL-fetching features need a separate controlled test to assess outbound destination restrictions; do not probe infrastructure metadata endpoints.

The bundled GET authorization helper does not automate validation tests. Record source findings and project-test evidence separately.
