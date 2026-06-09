// Mints a Supabase-style HS256 JWT API key signed with JWT_SECRET.
// Usage: JWT_SECRET=... node mint-jwt.mjs <anon|service_role>
// No external dependencies — uses Node's built-in crypto.
import { createHmac } from 'node:crypto';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters.');
  process.exit(1);
}

const role = process.argv[2];
if (role !== 'anon' && role !== 'service_role') {
  console.error('usage: JWT_SECRET=... node mint-jwt.mjs <anon|service_role>');
  process.exit(1);
}

const b64url = (input) => Buffer.from(input).toString('base64url');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 years

const header = { alg: 'HS256', typ: 'JWT' };
const payload = { role, iss: 'supabase', iat, exp };
const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');

process.stdout.write(`${signingInput}.${signature}`);
