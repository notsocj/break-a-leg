// Test files are skipped even when they import a provider SDK.
import OpenAI from 'openai';
export const client = new OpenAI();
