// Simulate a real NextAuth credentials login flow
const BASE = 'https://my-project-lemon-five-83.vercel.app';

async function main() {
  // 1) Get CSRF token + cookie
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: 'include' });
  const csrfToken = (await csrfRes.json()).csrfToken;
  const setCookie = csrfRes.headers.get('set-cookie') || '';
  const cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  console.log('CSRF:', csrfToken);
  console.log('Cookies:', cookies);

  // 2) POST credentials
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
    },
    body: new URLSearchParams({
      email: 'admin@mural.es',
      password: 'Mural2024!',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });
  console.log('Login status:', loginRes.status);
  console.log('Set-Cookie:', loginRes.headers.get('set-cookie'));
  console.log('Location:', loginRes.headers.get('location'));
  const body = await loginRes.text();
  console.log('Body (first 300):', body.slice(0, 300));
}
main().catch(e => { console.error(e); process.exit(1); });
