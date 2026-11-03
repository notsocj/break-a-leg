// Synthetic fixture: Edge Function calling Anthropic with no per-user limit.
import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic();

Deno.serve(async req => {
  const { question } = await req.json();
  const reply = await anthropic.messages.create({ model: 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: question }] });
  return Response.json(reply);
});
