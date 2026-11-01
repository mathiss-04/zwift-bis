# Étape 9 — Page et simulateur

## Objectif

Première page dans le navigateur. Un petit serveur local sert les fichiers du projet, et un faux home-trainer envoie une puissance réglée au curseur. Il a la même interface que le vrai trainer de l'étape 11, ce qui permet de tout développer sans matériel.

## Fichiers à créer ou modifier (et rien d'autre)

- `tools/serve.mjs` (créer)
- `src/devices/simulator.js` (créer)
- `index.html` (créer)
- `package.json` (ajouter uniquement le script `start`)
- `test/serve.test.js` (créer)
- `test/simulator.test.js` (créer)

**Important : ne lance jamais `npm start` ni `node tools/serve.mjs`.** Le serveur ne s'arrête pas seul et bloquerait ta session. Pour vérifier le chargement : `node -e "import('./tools/serve.mjs')"`.

## `package.json`

```json
"scripts": { "test": "node --test", "start": "node tools/serve.mjs" }
```

## `tools/serve.mjs`

Modules Node uniquement : `node:http`, `node:fs/promises`, `node:path`, `node:url`. Commenter en français.

### Constantes
`export const DEFAULT_PORT = 8000;` et une table interne des types :

| Extension | Type |
|---|---|
| `.html` | `text/html; charset=utf-8` |
| `.js`, `.mjs` | `text/javascript; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.json` | `application/json; charset=utf-8` |
| `.zwo` | `application/xml; charset=utf-8` |
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |
| `.svg` | `image/svg+xml` |
| `.glb` | `model/gltf-binary` |
| `.bin` | `application/octet-stream` |

### `contentType(filePath)` (exportée) → texte
Cherche `extname(filePath)` en minuscules dans la table. Par défaut : `application/octet-stream`.

### `resolvePath(rootDir, urlPath)` (exportée) → chemin ou `null`
1. Garder ce qui précède le premier `?` ou `#` : `urlPath.split(/[?#]/)[0]`.
2. `decodeURIComponent`, dans un `try/catch` : en cas d'erreur, retourner `null`.
3. Si le texte décodé contient `'\0'` : retourner `null`.
4. Découper avec `split(/[\\/]/)`. Si un morceau commence par un point : retourner `null`. Cette règle bloque à la fois `..` (sortir du projet) et `.git`.
5. Si le texte finit par `/`, lui ajouter `index.html`.
6. Retourner `join(rootDir, texte)`.

### `send(res, status, text)` (interne)
`res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })`, puis `res.end(text)`.

### `handleRequest(rootDir, req, res)` (interne, `async`)
1. Méthode autre que `GET` ou `HEAD` : `send` 405, `Méthode non autorisée`.
2. `resolvePath(rootDir, req.url)` vaut `null` : `send` 403, `Accès refusé`.
3. Dans un `try` : `readFile`, puis `writeHead(200, { 'Content-Type': contentType(chemin), 'Cache-Control': 'no-store' })`, puis `res.end` avec le contenu (sans contenu pour `HEAD`). `no-store` évite que le navigateur garde un ancien module pendant le développement.
4. Dans le `catch` (fichier absent ou dossier) : `send` 404, `Introuvable`.

### `startServer({ rootDir, port = DEFAULT_PORT, host = '127.0.0.1' })` (exportée) → `Promise<serveur>`
Crée le serveur avec `createServer`. La promesse est rejetée à la première erreur (`server.once('error', reject)`) et résolue quand l'écoute commence. `127.0.0.1` limite l'accès à ce Mac.

### Démarrage direct, en fin de fichier
Seulement si `process.argv[1] === fileURLToPath(import.meta.url)` :
- `rootDir` = le dossier parent de `tools/` ;
- `startServer({ rootDir })`, puis afficher `Zwift Bis : http://localhost:8000 (Ctrl+C pour arrêter)` avec `DEFAULT_PORT` ;
- en cas d'erreur : afficher `Le port 8000 est déjà utilisé` si `error.code === 'EADDRINUSE'`, sinon `error.message`, puis `process.exit(1)`.

## `src/devices/simulator.js`

Sans import, sans DOM. Une fonction qui fabrique un objet (pas de classe) :

```js
export const SIM_CADENCE_RPM = 90;
```

`clampPower(w)` (interne) = `Math.max(0, Math.round(w))`.

### `createSimulator({ intervalMs = 1000, timers = globalThis } = {})` → objet
`timers` fournit `setInterval` et `clearInterval` : les tests peuvent ainsi remplacer l'horloge. Appeler `timers.setInterval(...)`.

État privé : `riderPowerW = 0`, `targetW = null`, `gradePct = 0`, `timerId = null`, et un `Set` de fonctions à prévenir.

Donnée courante : `powerW = targetW ?? riderPowerW`, et `cadenceRpm = powerW > 0 ? SIM_CADENCE_RPM : 0`. Comme un vrai trainer en ERG, une cible remplace la puissance du cycliste. Une cible de 0 W reste une cible.

Méthodes de l'objet retourné :

| Méthode | Effet |
|---|---|
| `async connect()` | Si déjà connecté : rien. Sinon, lance le minuteur, qui envoie la donnée courante toutes les `intervalMs`, et l'envoie aussi une fois tout de suite. |
| `async disconnect()` | Si non connecté : rien. Sinon, `clearInterval` et `timerId = null`. |
| `onData(cb)` | Ajoute `cb`. Retourne une fonction qui le retire. `cb` reçoit `{ powerW, cadenceRpm }`. |
| `async setGrade(pourcent)` | `gradePct = pourcent`, `targetW = null` : suivre une pente fait quitter l'ERG. |
| `async setTargetPower(watts)` | `targetW = clampPower(watts)`. |
| `setPower(watts)` | `riderPowerW = clampPower(watts)`. N'envoie rien : la donnée part au prochain tic. Propre au simulateur. |
| `getState()` | `{ connected: timerId !== null, powerW, cadenceRpm, gradePct, targetW }`. |

## `index.html`

Recopier exactement :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zwift Bis</title>
  <link rel="icon" href="data:,">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 2rem auto; padding: 0 1rem; }
    input[type="range"] { width: 100%; }
    #power-value { font-size: 2rem; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Zwift Bis</h1>
  <label for="power">Puissance du simulateur</label>
  <input id="power" type="range" min="0" max="600" step="5" value="200">
  <p id="power-value"></p>
  <p id="sim-data">Simulateur : en attente</p>
  <script type="module">
    import { createSimulator } from './src/devices/simulator.js';

    const sim = createSimulator();
    const slider = document.getElementById('power');
    const value = document.getElementById('power-value');
    const data = document.getElementById('sim-data');

    function applyPower() {
      const watts = Number(slider.value);
      value.textContent = `${watts} W`;
      sim.setPower(watts);
    }

    slider.addEventListener('input', applyPower);
    sim.onData(({ powerW, cadenceRpm }) => {
      data.textContent = `Simulateur : ${powerW} W, ${cadenceRpm} tr/min`;
    });
    applyPower();
    sim.connect();
  </script>
</body>
</html>
```

## Tests

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`. Utiliser `node:test` et `node:assert/strict`.

### `test/serve.test.js`

```js
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let server, base;
before(async () => {
  server = await startServer({ rootDir: ROOT, port: 0 }); // 0 : un port libre au hasard
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });
```

**Constante** : `DEFAULT_PORT` = 8000.

**contentType**

| Fichier | Type |
|---|---|
| `a.html` | `text/html; charset=utf-8` |
| `a.js` | `text/javascript; charset=utf-8` |
| `A.JSON` | `application/json; charset=utf-8` |
| `h.bin` | `application/octet-stream` |
| `a.xyz` | `application/octet-stream` |
| `sans` | `application/octet-stream` |

**resolvePath**, avec `rootDir = '/site'`

| URL | Résultat |
|---|---|
| `/` | `/site/index.html` |
| `/src/` | `/site/src/index.html` |
| `/src/app.js` | `/site/src/app.js` |
| `/src/app.js?v=1` | `/site/src/app.js` |
| `/a%20b.js` | `/site/a b.js` |
| `/../secret` | `null` |
| `/%2e%2e/secret` | `null` |
| `/src/../../secret` | `null` |
| `/.git/config` | `null` |
| `/%E0%A4%A` | `null` |
| `/a%00b` | `null` |

**Requêtes réelles**, avec `fetch(base + chemin)`. Lire chaque corps avec `await r.text()`.

| Méthode | Chemin | Statut | À vérifier aussi |
|---|---|---|---|
| GET | `/` | 200 | `content-type` = `text/html; charset=utf-8`, `cache-control` = `no-store`, le corps contient `id="power"` |
| GET | `/src/devices/simulator.js` | 200 | `content-type` = `text/javascript; charset=utf-8` |
| GET | `/absent.txt` | 404 | |
| GET | `/src` | 404 | |
| GET | `/.git/config` | 403 | |
| POST | `/` | 405 | |
| HEAD | `/` | 200 | le corps est vide |

### `test/simulator.test.js`

```js
function fakeTimers() {
  const t = {
    callback: null, intervalMs: null, setCount: 0, clearCount: 0,
    setInterval(fn, ms) { t.callback = fn; t.intervalMs = ms; t.setCount++; return 42; },
    clearInterval(id) { if (id === 42) { t.callback = null; t.clearCount++; } },
  };
  return t;
}
function setup() {
  const timers = fakeTimers();
  const sim = createSimulator({ timers });
  const received = [];
  sim.onData((d) => received.push(d));
  return { timers, sim, received };
}
```

`timers.callback()` simule un tic d'horloge. Utiliser `assert.deepEqual` pour les objets. Un test par paragraphe :

**Départ** : `SIM_CADENCE_RPM` = 90. `getState()` = `{ connected: false, powerW: 0, cadenceRpm: 0, gradePct: 0, targetW: null }`. Après `setPower(200)` sans connexion, `received` reste `[]`.

**Connexion** : après `await sim.connect()` : `timers.intervalMs` = 1000, `received` = `[{ powerW: 0, cadenceRpm: 0 }]`, `getState().connected` = true. Après un second `connect()` : `timers.setCount` = 1 et `received.length` = 1.

**Puissance** : une fois connecté, `setPower(200)` laisse `received.length` à 1. Après un tic, `received[1]` = `{ powerW: 200, cadenceRpm: 90 }`. Puis, avec `setPower` suivi d'un tic, le dernier `powerW` reçu vaut :

| setPower | powerW |
|---|---|
| 199.6 | 200 |
| -5 | 0 |
| 0 | 0 |

**ERG**, connecté, dans cet ordre, avec un tic avant de lire le dernier reçu

| Action | Dernier reçu |
|---|---|
| `setPower(100)` puis `await setTargetPower(150)` | `{ powerW: 150, cadenceRpm: 90 }` |
| `await setTargetPower(0)` | `{ powerW: 0, cadenceRpm: 0 }` |
| `await setTargetPower(150)` puis `await setGrade(5)` | `{ powerW: 100, cadenceRpm: 90 }` |

À la première ligne, `getState().targetW` = 150. À la dernière, `getState()` = `{ connected: true, powerW: 100, cadenceRpm: 90, gradePct: 5, targetW: null }`.

**Déconnexion** : après `connect()` puis `disconnect()` : `timers.callback` = null, `timers.clearCount` = 1, `getState().connected` = false. Un second `disconnect()` laisse `clearCount` à 1. Un nouveau `connect()` donne `timers.setCount` = 2.

**Désabonnement** : deux abonnés `a` et `b`, sur un simulateur créé sans `setup`. Après `connect()`, retirer `a` puis faire un tic : `a` a reçu 1 donnée, `b` en a reçu 2.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

```bash
npm start
```

Ouvrir `http://localhost:8000` dans Chrome. La page affiche `200 W`. En bougeant le curseur, la valeur change aussitôt, et la ligne `Simulateur` suit en une seconde au plus. `Ctrl+C` arrête le serveur.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `AGENTS.md` ou `docs/`.
- Pas de `src/app.js`, de HUD ni de boucle 20 Hz : c'est l'étape 10.
- Pas de `navigator.bluetooth` : c'est l'étape 11.
- Pas de dépendance npm, pas de rechargement automatique de la page.
- Ne jamais lancer `npm start` ni `node tools/serve.mjs` pendant cette étape.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
