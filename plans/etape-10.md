# Étape 10 — Boucle et HUD minimal

## Objectif

Faire rouler le vélo à l'écran. Une boucle à 20 Hz lit la puissance du simulateur, fait avancer la sortie sur une route plate fictive, et un petit affichage (HUD) se met à jour 4 fois par seconde. À 200 W, la vitesse monte vers 33,9 km/h sans saut.

## Fichiers à créer ou modifier (et rien d'autre)

- `src/ui/hud.js` (créer)
- `src/app.js` (créer)
- `index.html` (remplacer entièrement)
- `test/hud.test.js` (créer)
- `test/app.test.js` (créer)

**Important : ne lance jamais `npm start` ni `node tools/serve.mjs`.** Le serveur ne s'arrête pas seul et bloquerait ta session.

## Modules existants à utiliser

```js
import { createRide, stepRide } from './core/ride.js';
// createRide(route, params) → { timeS, distanceM, speedMs, point: { grade, ... }, ... }
// stepRide(state, powerW, dtS) → nouvel état
```

Le simulateur existe déjà : `onData(cb)`, `async connect()`, `async disconnect()`, `setPower(watts)`.

## `src/ui/hud.js`

Sans import. Fonctions exportées, sauf `decimal`. La virgule est le séparateur décimal français.

`decimal(v, n)` (interne) : arrondit à `n` décimales, puis écrit avec une virgule :
`(Math.round(v * 10 ** n) / 10 ** n + 0).toFixed(n).replace('.', ',')`. Le `+ 0` évite d'afficher `-0,0`.

| Fonction | Résultat |
|---|---|
| `formatSpeed(kmh)` | `decimal(kmh, 1)` + ` km/h` |
| `formatPower(watts)` | `Math.round(watts)` + ` W` |
| `formatCadence(rpm)` | `Math.round(rpm)` + ` tr/min` |
| `formatDistance(m)` | `decimal(m / 1000, 2)` + ` km` |
| `formatGrade(pct)` | `decimal(pct, 1)` + ` %` |

### `formatDuration(s)` → texte
1. `t = Math.floor(Math.max(0, s) + 0.001)`. Le `0.001` absorbe les erreurs d'arrondi : 59,9999999 s compte pour 60 s.
2. `h = floor(t / 3600)`, `m = floor((t % 3600) / 60)`, `e = t % 60`.
3. Avec des heures : `h:mm:ss`. Sans heures : `m:ss`. Compléter `mm` et `ss` à deux chiffres avec `padStart`.

### `createHud(elements)` → `{ render(view) }`
`elements` a les clés `speed`, `power`, `cadence`, `distance`, `time`, `grade`. `render` écrit dans le `textContent` de chacun, à partir de `view` :

| Élément | Valeur |
|---|---|
| `speed` | `formatSpeed(view.speedKmh)` |
| `power` | `formatPower(view.powerW)` |
| `cadence` | `formatCadence(view.cadenceRpm)` |
| `distance` | `formatDistance(view.distanceM)` |
| `time` | `formatDuration(view.timeS)` |
| `grade` | `formatGrade(view.gradePct)` |

## `src/app.js`

Le chef d'orchestre. Il ne touche pas au DOM et ne démarre rien tout seul : `index.html` fait les branchements. On peut ainsi le tester sous Node.

```js
export const STEP_MS = 50;           // pas de physique : 20 Hz
export const HUD_INTERVAL_MS = 250;  // affichage : 4 Hz
export const DATA_TIMEOUT_MS = 3000; // sans donnée depuis 3 s, la puissance vaut 0
export const MAX_CATCHUP_MS = 5000;  // rattrapage maximal en un seul tic
```

### `createFlatRoute({ lengthM = 10000, stepM = 10 } = {})` → parcours
Route fictive, en attendant les vrais parcours de l'étape 20. `n = Math.round(lengthM / stepM) + 1` points. `isLoop: true`, `lengthM`, `stepM`, `x[i] = i × stepM`, `z`, `grade` à 0 partout, `alt` à 100 partout.

### `createApp({ trainer, route, params, hud, now = () => performance.now(), timers = globalThis })` → objet
`now` et `timers` sont remplaçables pour que les tests contrôlent le temps. Appeler `timers.setInterval(...)`.

État privé : `ride = createRide(route, params)`, `powerW = 0`, `cadenceRpm = 0`, `lastDataMs = null`, `timerId = null`, `lastTickMs = 0`, `lastHudMs = 0`, `pendingMs = 0`.

`fresh(t)` (interne) : `lastDataMs !== null && t - lastDataMs <= DATA_TIMEOUT_MS`.

À la création, appeler `trainer.onData(receive)`, où `receive(data)` :
- met à jour `powerW` si `data.powerW` n'est pas `undefined`, et de même `cadenceRpm` : le vrai trainer peut envoyer une mesure en plusieurs morceaux ;
- puis `lastDataMs = now()`.

Méthodes de l'objet retourné :

**`getView()`** : avec `t = now()`, retourne
```js
{
  speedKmh: ride.speedMs * 3.6,  // m/s → km/h
  powerW: fresh(t) ? powerW : 0,
  cadenceRpm: fresh(t) ? cadenceRpm : 0,
  distanceM: ride.distanceM,
  timeS: ride.timeS,
  gradePct: ride.point.grade * 100, // fraction → pourcent
}
```

**`tick()`** :
1. `t = now()`.
2. `pendingMs += Math.min(t - lastTickMs, MAX_CATCHUP_MS)`, puis `lastTickMs = t`. Un minuteur n'est jamais ponctuel : on compte le temps réel, et le plafond évite de bondir en avant après une mise en veille.
3. `p = fresh(t) ? powerW : 0`.
4. Tant que `pendingMs >= STEP_MS` : `ride = stepRide(ride, p, STEP_MS / 1000)` et `pendingMs -= STEP_MS`. Le pas reste fixe, donc le résultat ne dépend pas de la régularité du minuteur.
5. Si `t - lastHudMs >= HUD_INTERVAL_MS` : `hud.render(getView())` et `lastHudMs = t`.

**`async start()`** : si `timerId !== null`, ne rien faire. Sinon : `await trainer.connect()`, `lastTickMs = now()`, `lastHudMs = lastTickMs`, `timerId = timers.setInterval(tick, STEP_MS)`, puis `hud.render(getView())`.

**`async stop()`** : si `timerId === null`, ne rien faire. Sinon : `clearInterval`, `timerId = null`, `await trainer.disconnect()`.

## `index.html`

Remplacer tout le fichier par :

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
    #power-value { font-weight: 600; }
    #hud { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
    #hud div { display: flex; flex-direction: column; }
    #hud span { font-size: 0.85rem; }
    #hud output { font-size: 1.75rem; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Zwift Bis</h1>
  <label for="power">Puissance du simulateur : <span id="power-value"></span></label>
  <input id="power" type="range" min="0" max="600" step="5" value="200">
  <section id="hud">
    <div><span>Vitesse</span><output id="hud-speed"></output></div>
    <div><span>Puissance</span><output id="hud-power"></output></div>
    <div><span>Cadence</span><output id="hud-cadence"></output></div>
    <div><span>Distance</span><output id="hud-distance"></output></div>
    <div><span>Temps</span><output id="hud-time"></output></div>
    <div><span>Pente</span><output id="hud-grade"></output></div>
  </section>
  <script type="module">
    import { createParams } from './src/core/physics.js';
    import { createSimulator } from './src/devices/simulator.js';
    import { createHud } from './src/ui/hud.js';
    import { createApp, createFlatRoute } from './src/app.js';

    const byId = (id) => document.getElementById(id);
    const sim = createSimulator();
    const slider = byId('power');

    function applyPower() {
      const watts = Number(slider.value);
      byId('power-value').textContent = `${watts} W`;
      sim.setPower(watts);
    }
    slider.addEventListener('input', applyPower);
    applyPower();

    const hud = createHud({
      speed: byId('hud-speed'),
      power: byId('hud-power'),
      cadence: byId('hud-cadence'),
      distance: byId('hud-distance'),
      time: byId('hud-time'),
      grade: byId('hud-grade'),
    });
    const app = createApp({
      trainer: sim,
      route: createFlatRoute(),
      params: createParams(75, 8), // cycliste 75 kg, vélo 8 kg
      hud,
    });
    app.start();
  </script>
</body>
</html>
```

## Tests

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`. Utiliser `node:test` et `node:assert/strict`.

### `test/hud.test.js`

Égalité stricte, un test par ligne ou par fonction :

| Appel | Résultat |
|---|---|
| `formatSpeed(0)` | `0,0 km/h` |
| `formatSpeed(33.94)` | `33,9 km/h` |
| `formatSpeed(9.96)` | `10,0 km/h` |
| `formatPower(199.6)` | `200 W` |
| `formatPower(0)` | `0 W` |
| `formatCadence(89.5)` | `90 tr/min` |
| `formatDistance(0)` | `0,00 km` |
| `formatDistance(2730.14)` | `2,73 km` |
| `formatDistance(12345)` | `12,35 km` |
| `formatGrade(0)` | `0,0 %` |
| `formatGrade(5.04)` | `5,0 %` |
| `formatGrade(-0.04)` | `0,0 %` |
| `formatGrade(-5)` | `-5,0 %` |
| `formatDuration(0)` | `0:00` |
| `formatDuration(59.9)` | `0:59` |
| `formatDuration(59.9999999)` | `1:00` |
| `formatDuration(60)` | `1:00` |
| `formatDuration(605)` | `10:05` |
| `formatDuration(3661)` | `1:01:01` |
| `formatDuration(-5)` | `0:00` |

**createHud** : avec des objets vides `{}` comme éléments, `render({ speedKmh: 33.94, powerW: 200, cadenceRpm: 90, distanceM: 2730.14, timeS: 300, gradePct: 0 })` donne les `textContent` : `speed` `33,9 km/h`, `power` `200 W`, `cadence` `90 tr/min`, `distance` `2,73 km`, `time` `5:00`, `grade` `0,0 %`.

### `test/app.test.js`

Recopier ces utilitaires. Chaque test crée son propre `setup()` et commence par `await s.app.start()`.

```js
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

function setup() {
  const clock = { ms: 0 };
  const timers = {
    setCount: 0, clearCount: 0, intervalMs: null, callback: null,
    setInterval(fn, ms) { timers.callback = fn; timers.intervalMs = ms; timers.setCount++; return 7; },
    clearInterval(id) { if (id === 7) { timers.callback = null; timers.clearCount++; } },
  };
  const trainer = {
    cb: null, connected: 0, disconnected: 0,
    onData(cb) { trainer.cb = cb; },
    async connect() { trainer.connected++; },
    async disconnect() { trainer.disconnected++; },
  };
  const renders = [];
  const hud = { render(view) { renders.push(view); } };
  const app = createApp({
    trainer, route: createFlatRoute(), params: createParams(75, 8), hud,
    now: () => clock.ms, timers,
  });
  const send = (powerW, cadenceRpm = 90) => trainer.cb({ powerW, cadenceRpm });
  // Avance de durMs par pas de 50 ms. Si `watts` est fourni, envoie une mesure à chaque seconde.
  const run = (durMs, watts) => {
    for (let e = STEP_MS; e <= durMs; e += STEP_MS) {
      clock.ms += STEP_MS;
      if (watts !== undefined && clock.ms % 1000 === 0) send(watts);
      app.tick();
    }
  };
  return { clock, timers, trainer, renders, app, send, run };
}
```

**Constantes** : `STEP_MS` 50, `HUD_INTERVAL_MS` 250, `DATA_TIMEOUT_MS` 3000, `MAX_CATCHUP_MS` 5000.

**createFlatRoute** : `r = createFlatRoute()` ; `validateRoute(r) === r` (importé de `core/route.js`), `r.isLoop` true, `r.lengthM` 10000, `r.alt.length` 1001, `r.grade[500]` 0. `createFlatRoute({ lengthM: 100, stepM: 10 }).x[10]` = 100.

**Roulage à 200 W** : `s.send(200)`, puis `s.run(durée, 200)`, puis lire `getView()`

| Durée (ms) | speedKmh ±0.01 | distanceM ±0.001 | timeS ±0.001 |
|---|---|---|---|
| 60000 | 33.599 | 468.616 | 60 |
| 300000 | 33.943 | 2730.140 | 300 |

Dans les deux cas : `powerW` = 200, `cadenceRpm` = 90, `gradePct` = 0.

**Pas de saut** : `s.send(200)`, puis 1200 fois `s.run(50, 200)`. À chaque fois, `speedKmh` est plus grand que le précédent, et l'écart reste inférieur à 0.45.

**Sans aucune donnée** : `powerW` vaut 0 dès le départ. Après `s.run(1000)` : `speedKmh` = 0, `distanceM` = 0, `timeS` = 1 ±0.000001.

**Plus de données** : `s.send(200)`, puis `s.run(3000)` : `powerW` 200 et `cadenceRpm` 90. Puis `s.run(50)` : `powerW` 0 et `cadenceRpm` 0. Puis `s.send(150)` : `powerW` 150.

**Mesure en morceaux** : `s.send(200, 90)`, puis `s.trainer.cb({ cadenceRpm: 80 })` : `powerW` 200, `cadenceRpm` 80. Puis `s.trainer.cb({ powerW: 210 })` : `powerW` 210, `cadenceRpm` 80.

**Minuteur irrégulier** : avancer `s.clock.ms` puis appeler `s.app.tick()`. Tolérance 0.000001 sur `timeS`.

| Avance (ms) | timeS |
|---|---|
| 70 | 0.05 |
| 70 | 0.1 |
| 70 | 0.2 |
| 40 | 0.25 |

**Rattrapage plafonné** : `s.send(200)`, avance de 1000 ms puis `tick` : `timeS` = 1. Avance de 60000 ms puis `tick` : `timeS` = 6 (5 s rattrapées, pas 60). Tolérance 0.000001.

**Fréquence du HUD** : après `start`, `renders.length` = 1. Après `s.run(200)` : 1. Après `s.run(50)` : 2. Après `s.run(750)` : 5, et `renders[4].timeS` = 1 ±0.000001.

**Démarrage et arrêt** : un second `start()` laisse `trainer.connected` à 1 et `timers.setCount` à 1, avec `timers.intervalMs` = 50. Après `stop()` : `trainer.disconnected` = 1 et `timers.clearCount` = 1. Un second `stop()` laisse `trainer.disconnected` à 1.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

```bash
npm start
```

Ouvrir `http://localhost:8000` dans Chrome et garder l'onglet visible. Avec le curseur à 200 W, la vitesse monte sans saut : environ 33,6 km/h à 1 min, puis 33,9 km/h après quelques minutes. La distance et le temps augmentent, et la pente reste à `0,0 %`. À 0 W, la vitesse redescend doucement. `Ctrl+C` arrête le serveur.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de `navigator.bluetooth` ni de vrai trainer : c'est l'étape 11.
- Pas d'envoi de consigne au trainer, ni de `resistance.js` dans la boucle : ce sont les étapes suivantes.
- Pas de 3D, de vrai parcours, de séance ERG, d'enregistrement ni de sauvegarde.
- Pas de dépendance npm.
- Ne jamais lancer `npm start` ni `node tools/serve.mjs` pendant cette étape.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
