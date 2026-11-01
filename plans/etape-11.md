# Étape 11 — Connexion et lecture

## Objectif

Connecter le vrai Zwift Hub One en Bluetooth et rouler avec sa puissance et sa cadence réelles. Cette étape ne fait que lire : aucune commande n'est envoyée au Hub. Les trames brutes restent visibles à l'écran, pour trancher les points ouverts du protocole. Le test sur le vrai matériel revient à l'utilisateur.

## Fichiers à créer ou modifier (et rien d'autre)

- `src/devices/ftms.js` (créer)
- `src/ui/pairing.js` (créer)
- `index.html` (remplacer entièrement)
- `test/ftms.test.js` (créer)
- `test/pairing.test.js` (créer)

**Important : ne lance jamais `npm start` ni `node tools/serve.mjs`.** Le serveur ne s'arrête pas seul et bloquerait ta session.

## Modules existants à utiliser

```js
import { decodeIndoorBikeData } from '../core/ftms-codec.js';
// decodeIndoorBikeData(dataView, { resistanceBytes }) → { truncated, powerW?, cadenceRpm?, ... }
```

`createApp({ trainer, route, params, hud })` existe déjà. Il appelle `trainer.onData(cb)` à sa création, `await trainer.connect()` dans `start()` et `await trainer.disconnect()` dans `stop()`.

## `src/devices/ftms.js`

Pas de DOM. `bluetooth` est reçu en paramètre : les tests peuvent ainsi fournir un faux Bluetooth. Commenter en français.

```js
export const FTMS_SERVICE = 0x1826;     // service Fitness Machine
export const INDOOR_BIKE_DATA = 0x2ad2; // mesures du home-trainer
```

### `frameToHex(dataView)` (exportée) → texte
Chaque octet en hexadécimal majuscule sur deux chiffres, séparés par une espace. Exemple : `44 00 E8 03`.

### `createFtmsTrainer({ bluetooth, resistanceBytes = 1 } = {})` (exportée) → objet
État privé : `device = null`, `characteristic = null`, et trois `Set` d'abonnés (données, trames, statuts).

Fonctions internes :

**`handleValue(event)`**, appelée à chaque notification :
1. `dv = event.target.value`. Envoyer `frameToHex(dv)` aux abonnés des trames, toujours en premier.
2. `d = decodeIndoorBikeData(dv, { resistanceBytes })`.
3. Construire `data` avec seulement `powerW` et `cadenceRpm`, s'ils ne sont pas `undefined`.
4. Si `data` n'est pas vide, l'envoyer aux abonnés des données.

**`release()`** : si `characteristic` existe, retirer `handleValue` de `characteristicvaluechanged` et remettre `characteristic` à `null`. Si `device` existe, retirer `handleDrop` de `gattserverdisconnected` et remettre `device` à `null`.

**`handleDrop()`** : `release()`, puis statut `disconnected`.

Méthodes de l'objet retourné :

**`async connect()`**
1. Si `device !== null` : ne rien faire.
2. Si `bluetooth` est absent : lancer une `Error` dont `name` vaut `NotSupportedError`.
3. Statut `searching`. Puis, dans un `try`, avec `chosen` déclaré avant à `null` :
   - `chosen = await bluetooth.requestDevice({ filters: [{ services: [FTMS_SERVICE] }] })` ;
   - statut `connecting` ;
   - `device = chosen`, puis écouter `gattserverdisconnected` avec `handleDrop` ;
   - `server = await device.gatt.connect()` ;
   - `service = await server.getPrimaryService(FTMS_SERVICE)` ;
   - `characteristic = await service.getCharacteristic(INDOOR_BIKE_DATA)` ;
   - écouter `characteristicvaluechanged` avec `handleValue` ;
   - `await characteristic.startNotifications()` ;
   - statut `connected`.
4. Dans le `catch (error)` : `release()`, `chosen.gatt.disconnect()` si `chosen` existe, statut `idle`, puis relancer `error`.

**`async disconnect()`** : si `device === null`, ne rien faire. Sinon : garder `device` dans une variable `d`, `release()`, `d.gatt.disconnect()`, statut `disconnected`.

**`onData(cb)`, `onRaw(cb)`, `onStatus(cb)`** : ajoutent `cb` au `Set` correspondant et retournent une fonction qui le retire. `onData` reçoit `{ powerW?, cadenceRpm? }`, `onRaw` un texte, `onStatus` un statut.

## `src/ui/pairing.js`

Sans import. Fonctions exportées :

```js
export const MAX_FRAMES = 8; // nombre de trames affichées
```

### `statusText(status)` → texte
Retourne `status` lui-même s'il est inconnu.

| Statut | Texte |
|---|---|
| `idle` | `Hub non connecté` |
| `searching` | `Choisis ton Hub dans la fenêtre du navigateur` |
| `connecting` | `Connexion au Hub…` |
| `connected` | `Hub connecté` |
| `disconnected` | `Hub déconnecté` |

### `describeError(error)` → texte
Selon `error.name` :

| Nom | Texte |
|---|---|
| `NotFoundError` | `Aucun Hub sélectionné. S'il n'apparaît pas dans la liste, vérifie qu'il est allumé et que Zwift est bien fermé.` |
| `NetworkError` | `Connexion au Hub impossible. Zwift l'utilise peut-être encore : ferme-le, puis réessaie.` |
| `SecurityError` | `Bluetooth refusé par le navigateur. Vérifie l'autorisation du site et l'adresse en HTTPS.` |
| `NotSupportedError` | `Ce navigateur ne gère pas le Bluetooth : utilise Chrome ou Edge.` |
| autre | `` `Erreur Bluetooth : ${error.message}` `` |

### `createPairing({ elements, trainer, onConnect, onError })`
`elements` a les clés `connect` (bouton), `status` et `frames`.

1. Écrire `statusText('idle')` dans `elements.status.textContent`.
2. `trainer.onStatus(s => ...)` : écrire `statusText(s)` dans le statut. `elements.connect.disabled` vaut `true` si `s` est `searching`, `connecting` ou `connected`, sinon `false`.
3. `trainer.onRaw(hex => ...)` : ajouter `hex` en tête d'une liste limitée à `MAX_FRAMES`, puis écrire `liste.join('\n')` dans `elements.frames.textContent`.
4. Au `click` du bouton (fonction `async`) : `await onConnect()`. En cas d'erreur : écrire `describeError(error)` dans le statut, `elements.connect.disabled = false`, puis `await onError()`.

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
    button { font: inherit; padding: 0.5rem 1rem; }
    #power-value { font-weight: 600; }
    #hub-status { font-weight: 600; }
    #hub-frames { min-height: 1.5rem; font-size: 0.85rem; overflow-x: auto; }
    #hud { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
    #hud div { display: flex; flex-direction: column; }
    #hud span { font-size: 0.85rem; }
    #hud output { font-size: 1.75rem; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Zwift Bis</h1>
  <p><button id="hub-connect" type="button">Connecter le Hub</button></p>
  <p id="hub-status"></p>
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
  <h2>Trames brutes du Hub</h2>
  <pre id="hub-frames"></pre>
  <script type="module">
    import { createParams } from './src/core/physics.js';
    import { createSimulator } from './src/devices/simulator.js';
    import { createFtmsTrainer } from './src/devices/ftms.js';
    import { createHud } from './src/ui/hud.js';
    import { createPairing } from './src/ui/pairing.js';
    import { createApp, createFlatRoute } from './src/app.js';

    const byId = (id) => document.getElementById(id);
    const sim = createSimulator();
    const hub = createFtmsTrainer({ bluetooth: navigator.bluetooth });
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
    const makeApp = (trainer) => createApp({
      trainer,
      route: createFlatRoute(),
      params: createParams(75, 8), // cycliste 75 kg, vélo 8 kg
      hud,
    });
    const simApp = makeApp(sim);
    const hubApp = makeApp(hub);

    createPairing({
      elements: {
        connect: byId('hub-connect'),
        status: byId('hub-status'),
        frames: byId('hub-frames'),
      },
      trainer: hub,
      // Le navigateur n'ouvre la fenêtre Bluetooth qu'à la suite d'un clic.
      async onConnect() {
        await simApp.stop();
        await hubApp.stop();
        slider.disabled = true;
        await hubApp.start();
      },
      // Échec : on revient au simulateur.
      async onError() {
        slider.disabled = false;
        await simApp.start();
      },
    });
    simApp.start();
  </script>
</body>
</html>
```

## Tests

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`. Utiliser `node:test` et `node:assert/strict`.

### `test/ftms.test.js`

Recopier ces utilitaires :

```js
const dv = (b) => new DataView(Uint8Array.from(b).buffer);

class Target {
  listeners = {};
  addEventListener(t, f) { (this.listeners[t] ??= new Set()).add(f); }
  removeEventListener(t, f) { this.listeners[t]?.delete(f); }
  fire(t) { for (const f of [...(this.listeners[t] ?? [])]) f({ target: this }); }
  count(t) { return this.listeners[t]?.size ?? 0; }
}

// `failures` : { étape: nomDeLErreur }. Étapes : request, gatt, service, characteristic, notify.
function fakeBluetooth(failures = {}) {
  const log = [];
  const devices = [];
  function step(name) {
    if (failures[name]) throw Object.assign(new Error(failures[name]), { name: failures[name] });
    log.push(name);
  }
  function newDevice() {
    const ch = new Target();
    ch.send = (b) => { ch.value = dv(b); ch.fire('characteristicvaluechanged'); };
    ch.startNotifications = async () => step('notify');
    const service = { getCharacteristic: async () => { step('characteristic'); return ch; } };
    const server = { getPrimaryService: async () => { step('service'); return service; } };
    const d = new Target();
    d.ch = ch;
    d.disconnects = 0;
    d.gatt = { connect: async () => { step('gatt'); return server; }, disconnect() { d.disconnects++; } };
    devices.push(d);
    return d;
  }
  return {
    log, devices, options: null, requests: 0,
    async requestDevice(o) { this.options = o; this.requests++; step('request'); return newDevice(); },
  };
}

function setup(failures) {
  const bluetooth = fakeBluetooth(failures);
  const trainer = createFtmsTrainer({ bluetooth });
  const data = [], raw = [], status = [];
  trainer.onData((d) => data.push(d));
  trainer.onRaw((h) => raw.push(h));
  trainer.onStatus((s) => status.push(s));
  return { bluetooth, trainer, data, raw, status };
}
```

**Constantes** : `FTMS_SERVICE` = 0x1826, `INDOOR_BIKE_DATA` = 0x2ad2.

**frameToHex** : `dv([0x44, 0, 0xE8, 3])` → `44 00 E8 03` ; `dv([])` → texte vide.

**Connexion** : après `await s.trainer.connect()`, avec `assert.deepEqual` :
- `s.bluetooth.options` = `{ filters: [{ services: [0x1826] }] }` ;
- `s.bluetooth.log` = `['request', 'gatt', 'service', 'characteristic', 'notify']` ;
- `s.status` = `['searching', 'connecting', 'connected']`.

Un second `connect()` laisse `s.bluetooth.requests` à 1.

**Trames** : une fois connecté, `const c = s.bluetooth.devices[0].ch`. Pour chaque ligne, `s.data.length = 0`, `c.send(trame)`, puis vérifier le dernier élément de `s.raw` et `s.data`.

| Trame | Dernière trame brute | `s.data` |
|---|---|---|
| `[0x44, 0, 0xE8, 3, 0xB4, 0, 0xC8, 0]` | `44 00 E8 03 B4 00 C8 00` | `[{ powerW: 200, cadenceRpm: 90 }]` |
| `[0x41, 0, 0xC8, 0]` | `41 00 C8 00` | `[{ powerW: 200 }]` |
| `[0x05, 0, 0xB4, 0]` | `05 00 B4 00` | `[{ cadenceRpm: 90 }]` |
| `[0x64, 0, 0xE8, 3, 0xB4, 0, 5, 0xC8, 0]` | `64 00 E8 03 B4 00 05 C8 00` | `[{ powerW: 200, cadenceRpm: 90 }]` |
| `[0x01, 0]` | `01 00` | `[]` |
| `[0x00, 0, 0xE8, 3]` | `00 00 E8 03` | `[]` |
| `[0x44, 0, 0xE8, 3, 0xB4]` | `44 00 E8 03 B4` | `[]` |

**Résistance sur 2 octets** : `createFtmsTrainer({ bluetooth: fakeBluetooth(), resistanceBytes: 2 })`, trame `[0x64, 0, 0xE8, 3, 0xB4, 0, 5, 0, 0xC8, 0]` : données `[{ powerW: 200, cadenceRpm: 90 }]`.

**Déconnexion** : avant toute connexion, `disconnect()` laisse `s.status` à `[]`. Après `connect()` puis `disconnect()`, avec `d = s.bluetooth.devices[0]` :
- `d.disconnects` = 1, `s.status.length` = 4, dernier statut `disconnected` ;
- `d.ch.count('characteristicvaluechanged')` = 0 et `d.count('gattserverdisconnected')` = 0 ;
- `d.ch.send([0x44, 0, 0xE8, 3, 0xB4, 0, 0xC8, 0])` laisse `s.raw` à `[]` ;
- un second `disconnect()` laisse `d.disconnects` à 1.

**Coupure du Hub** : après `connect()`, `d.fire('gattserverdisconnected')` : dernier statut `disconnected`, et les deux `count` ci-dessus à 0. Un nouveau `connect()` donne `s.bluetooth.requests` = 2. Puis `s.bluetooth.devices[1].ch.send([0x41, 0, 0xC8, 0])` donne `s.data.length` = 1.

**Échecs** : `setup({ [étape]: nom })`, puis `await assert.rejects(s.trainer.connect(), { name: nom })`.

| Étape | Nom | `s.status` | `d.disconnects` |
|---|---|---|---|
| `request` | `NotFoundError` | `['searching', 'idle']` | pas d'appareil |
| `gatt` | `NetworkError` | `['searching', 'connecting', 'idle']` | 1 |
| `service` | `NotFoundError` | `['searching', 'connecting', 'idle']` | 1 |
| `notify` | `NetworkError` | `['searching', 'connecting', 'idle']` | 1 |

Quand un appareil existe (`d = s.bluetooth.devices[0]`) : `d.count('gattserverdisconnected')` = 0 et `d.ch.count('characteristicvaluechanged')` = 0.

**Nouvel essai après échec** : `const f = { gatt: 'NetworkError' }`, `setup(f)`, un `connect()` rejeté, `delete f.gatt`, un nouveau `connect()` : dernier statut `connected`, `requests` = 2.

**Sans Bluetooth** : `createFtmsTrainer({ bluetooth: undefined })` : `connect()` est rejeté avec `{ name: 'NotSupportedError' }` et aucun statut n'est envoyé.

### `test/pairing.test.js`

Recopier ces utilitaires :

```js
function setup({ onConnect = async () => {}, onError = async () => {} } = {}) {
  const elements = {
    connect: { disabled: false, click: null, addEventListener(t, f) { if (t === 'click') this.click = f; } },
    status: { textContent: '' },
    frames: { textContent: '' },
  };
  const trainer = { onStatus(c) { this.status = c; }, onRaw(c) { this.raw = c; } };
  createPairing({ elements, trainer, onConnect, onError });
  return { elements, trainer };
}
const named = (name, message = 'x') => Object.assign(new Error(message), { name });
```

**Constante** : `MAX_FRAMES` = 8.

**statusText** : les 5 lignes du tableau du plan, à recopier telles quelles.

**describeError**

| Erreur | Vérification |
|---|---|
| `named('NotFoundError')` | contient `Zwift` |
| `named('NetworkError')` | contient `Zwift` |
| `named('SecurityError')` | contient `HTTPS` |
| `named('NotSupportedError')` | contient `Chrome ou Edge` |
| `named('AbortError', 'coupé')` | égal à `Erreur Bluetooth : coupé` |

**Statuts** : au départ, le statut affiche `Hub non connecté`. Puis, avec `trainer.status(s)`, le texte vaut `statusText(s)` et `connect.disabled` vaut :

| s | disabled |
|---|---|
| `searching` | true |
| `connecting` | true |
| `connected` | true |
| `disconnected` | false |
| `idle` | false |

**Trames** : `trainer.raw('A')`, puis `trainer.raw('B')` : `frames.textContent` = `B\nA`. Puis dix appels `trainer.raw('F0')` à `trainer.raw('F9')` : 8 lignes, la première `F9`, la dernière `F2`.

**Clic réussi** : `await elements.connect.click()` appelle `onConnect` une fois et `onError` jamais.

**Clic en échec** : `onConnect` met `elements.connect.disabled` à `true`, puis lance `named('NetworkError')`. Après `await elements.connect.click()` : `onError` appelé une fois, `disabled` = false, et le statut vaut `describeError(named('NetworkError'))`.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

Sur le PC, avec Chrome ou Edge, sur la page publiée :

1. Zwift fermé, Hub allumé. Cliquer sur `Connecter le Hub` et choisir le Hub dans la fenêtre.
2. Le statut affiche `Hub connecté`. En pédalant, la puissance et la cadence suivent, et les trames brutes défilent.
3. Comparer la puissance affichée à celle attendue. Noter une ou deux trames : elles serviront à vérifier la taille du champ résistance.
4. Avec Zwift ouvert et connecté au Hub, recommencer : un message clair doit expliquer le problème. Noter le message obtenu.

## Ne pas faire

- Aucun autre fichier, et aucune modification de `src/app.js`, des autres modules, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de `requestControl`, de `Start` ni d'écriture sur le Control Point : ce sont les étapes 12 et 13.
- Pas de `setGrade` ni de `setTargetPower` dans `ftms.js` : étapes 12 et 13.
- Pas de ceinture cardio : étape 14.
- Pas de reconnexion automatique : étape 15.
- Pas de dépendance npm.
- Ne jamais lancer `npm start` ni `node tools/serve.mjs` pendant cette étape.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
