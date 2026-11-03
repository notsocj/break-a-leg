// Synthetic fixture: password sign-in limited per IP and email.
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/ratelimit';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(`login:${ip}:${email}`))) return new Response('Too many attempts', { status: 429 });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return new Response('Invalid login', { status: 401 });
  return Response.json({ session: data.session });
}
