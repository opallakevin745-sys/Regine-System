import http from 'node:http';
import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });
const login = await fetch('http://localhost:5006/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: process.env.SEED_ADMIN_PASSWORD })
});
const loginBody = await login.json();
if (!login.ok) throw new Error(`Owner login failed (${login.status})`);
const token = loginBody.data.token;
const bridge = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5180');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  if (request.url === '/session') response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ token }));
  else response.writeHead(404).end();
});
bridge.listen(5007, '127.0.0.1', () => console.log('Read-only report UI bridge ready on loopback port 5007.'));
