// Synthetic fixture: output is capped, but handling the provider's 429 is not a limit on callers.
import OpenAI from 'openai';

const client = new OpenAI();

export async function POST(req: Request) {
  const { text } = await req.json();
  try {
    const result = await client.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 300, messages: [{ role: 'user', content: text }] });
    return Response.json(result.choices[0].message);
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) return new Response('Busy', { status: 503 });
    throw error;
  }
}
