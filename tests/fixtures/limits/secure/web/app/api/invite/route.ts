// Synthetic fixture: invites are limited per sender through a relative import.
import { Resend } from 'resend';
import { checkRateLimit } from '../../../lib/ratelimit';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email, senderId } = await req.json();
  if (!(await checkRateLimit(`invite:${senderId}`))) return new Response('Too many requests', { status: 429 });
  await resend.emails.send({ from: 'team@example.com', to: email, subject: 'You are invited', html: '<p>Join us</p>' });
  return Response.json({ ok: true });
}
