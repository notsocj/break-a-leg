// Synthetic fixture: limited per user, capped output, model fixed on the server.
import OpenAI from 'openai';
import { checkRateLimit } from '@/lib/ratelimit';
import { getUser } from '@/lib/session';

const client = new OpenAI();

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!(await checkRateLimit(user.id))) return new Response('Too many requests', { status: 429 });
  const { messages } = await req.json();
  const result = await client.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 500, messages });
  return Response.json(result.choices[0].message);
}
