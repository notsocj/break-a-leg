// Synthetic fixture: a signed webhook does no abusable work and needs no caller limit.
import { validateEvent } from 'npm:@polar-sh/sdk/webhooks';

Deno.serve(async req => {
  const event = validateEvent(await req.text(), Object.fromEntries(req.headers), Deno.env.get('POLAR_WEBHOOK_SECRET')!);
  return Response.json({ received: event.type });
});
