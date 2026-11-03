// Synthetic fixture: sends an invite email to any address.
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// TODO: add a rate limit before launch
export async function POST(req: Request) {
  const { email } = await req.json();
  await resend.emails.send({ from: 'team@example.com', to: email, subject: 'You are invited', html: '<p>Join us</p>' });
  return Response.json({ ok: true });
}
