// Synthetic fixture: shared AI helper with no output cap.
import OpenAI from 'openai';

const client = new OpenAI();

export async function ask(options: { model: string; messages: Array<{ role: string; content: string }> }) {
  return client.chat.completions.create(options);
}
