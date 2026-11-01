// Tests du serveur local de développement (étape 9).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, startServer, contentType, resolvePath } from '../tools/serve.mjs';

// Racine du projet : le dossier parent de test/.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let server, base;
before(async () => {
  server = await startServer({ rootDir: ROOT, port: 0 }); // 0 : un port libre au hasard
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });

test('DEFAULT_PORT vaut 8000', () => {
  assert.equal(DEFAULT_PORT, 8000);
});

test('contentType : chaque extension donne son type', () => {
  const CAS = [
    ['a.html', 'text/html; charset=utf-8'],
    ['a.js', 'text/javascript; charset=utf-8'],
    ['A.JSON', 'application/json; charset=utf-8'],
    ['h.bin', 'application/octet-stream'],
    ['a.xyz', 'application/octet-stream'],
    ['sans', 'application/octet-stream'],
  ];
  for (const [fichier, type] of CAS) {
    assert.equal(contentType(fichier), type);
  }
});

test('resolvePath : URL → chemin dans le projet, ou null', () => {
  const CAS = [
    ['/', '/site/index.html'],
    ['/src/', '/site/src/index.html'],
    ['/src/app.js', '/site/src/app.js'],
    ['/src/app.js?v=1', '/site/src/app.js'],
    ['/a%20b.js', '/site/a b.js'],
    ['/../secret', null],
    ['/%2e%2e/secret', null],
    ['/src/../../secret', null],
    ['/.git/config', null],
    ['/%E0%A4%A', null],
    ['/a%00b', null],
  ];
  for (const [url, attendu] of CAS) {
    assert.equal(resolvePath('/site', url), attendu);
  }
});

// Requêtes réelles : on fait des fetch sur le serveur réellement démarré.

test('GET / : 200, bons en-têtes, corps de la page', async () => {
  const r = await fetch(base + '/');
  const corps = await r.text();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.ok(corps.includes('id="power"'));
});

test('GET /src/devices/simulator.js : 200, type JavaScript', async () => {
  const r = await fetch(base + '/src/devices/simulator.js');
  await r.text();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/javascript; charset=utf-8');
});

test('GET /absent.txt : 404', async () => {
  const r = await fetch(base + '/absent.txt');
  await r.text();
  assert.equal(r.status, 404);
});

test('GET /src : 404 (dossier)', async () => {
  const r = await fetch(base + '/src');
  await r.text();
  assert.equal(r.status, 404);
});

test('GET /.git/config : 403', async () => {
  const r = await fetch(base + '/.git/config');
  await r.text();
  assert.equal(r.status, 403);
});

test('POST / : 405', async () => {
  const r = await fetch(base + '/', { method: 'POST' });
  await r.text();
  assert.equal(r.status, 405);
});

test('HEAD / : 200, corps vide', async () => {
  const r = await fetch(base + '/', { method: 'HEAD' });
  const corps = await r.text();
  assert.equal(r.status, 200);
  assert.equal(corps, '');
});
