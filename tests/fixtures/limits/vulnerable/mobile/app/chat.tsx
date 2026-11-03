// Synthetic fixture: mobile screen calling the backend. Client code is not an entry point.
export async function sendMessage(text: string) {
  return fetch('https://example.invalid/api/chat', { method: 'POST', body: JSON.stringify({ text }) });
}
