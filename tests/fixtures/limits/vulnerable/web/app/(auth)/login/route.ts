// Synthetic fixture: server-side password sign-in with no attempt limit.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return new Response('Invalid login', { status: 401 });
  return Response.json({ session: data.session });
}
