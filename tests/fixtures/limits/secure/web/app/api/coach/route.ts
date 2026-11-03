// Synthetic fixture: a server-side credit balance caps each user's AI spend.
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getUser, spendCredit } from '@/lib/session';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!(await spendCredit(user.id))) return new Response('No credits left', { status: 402 });
  const { prompt } = await req.json();
  const { text } = await generateText({ model: openai('gpt-4o-mini'), maxOutputTokens: 400, prompt });
  return Response.json({ text });
}
