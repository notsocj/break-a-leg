// Synthetic fixture: sign-out has nothing to abuse.
export async function POST() {
  return new Response(null, { status: 204 });
}
