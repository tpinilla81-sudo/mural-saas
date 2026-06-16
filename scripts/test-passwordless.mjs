const BASE = 'https://my-project-lemon-five-83.vercel.app';
async function tryLogin(email) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: 'include' });
  const csrfToken = (await csrfRes.json()).csrfToken;
  const setCookie = csrfRes.headers.get('set-cookie') || '';
  const cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies },
    body: new URLSearchParams({ email, csrfToken, callbackUrl: `${BASE}/`, json: 'true' }).toString(),
    redirect: 'manual',
  });
  const sc = loginRes.headers.get('set-cookie') || '';
  const hasSession = sc.includes('session-token');
  console.log(`${email.padEnd(35)} → ${hasSession ? '✓ OK' : '✗ FAIL'}`);
}
// NO PASSWORD in body — passwordless
await tryLogin('admin@mural.es');
await tryLogin('mural@mural.app');
await tryLogin('juliomurillozardoya@gmail.com');
await tryLogin('nonexistent@example.com');  // should fail
