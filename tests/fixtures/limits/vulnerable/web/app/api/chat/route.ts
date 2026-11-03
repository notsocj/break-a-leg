// Synthetic fixture: signed-in chat route with no limit, no cap, and a caller-chosen model.
import { ask } from '@/lib/ai';
import { getUser } from '@/lib/session';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return new Response('Unauthorized', { status: 401 });
  const body = await req.json();
  const completion = await ask({ model: body.model, messages: body.messages });
  return Response.json(completion.choices[0].message);
}
