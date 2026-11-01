# Étape 8 — Décodage Bluetooth

## Objectif

Écrire les fonctions qui traduisent les octets Bluetooth en valeurs, et les valeurs en octets, sans aucun appel Bluetooth. Le home-trainer parle le protocole FTMS, la ceinture cardio le protocole Heart Rate. Tout se teste ici avec des trames écrites à la main ; le test sur le vrai matériel viendra à l'étape 11.

## Fichiers à créer (et rien d'autre)

- `src/core/ftms-codec.js`
- `src/core/hr-codec.js`
- `test/codecs.test.js`

## Conventions

Tous les nombres sur plusieurs octets sont **petit-boutistes** (l'octet de poids faible d'abord). Les fonctions d'encodage retournent un `Uint8Array`. Les fonctions de décodage reçoivent un `DataView`. Fonctions exportées, sans classe ni import. Commenter en français, avec les unités.

## `src/core/ftms-codec.js`

Une fonction interne `clamp(v, min, max)`, non exportée, puis :

### Commandes vers le Control Point

| Fonction | Octets |
|---|---|
| `encodeRequestControl()` | `00` |
| `encodeStart()` | `07` |
| `encodeStop()` | `08 01` |
| `encodePause()` | `08 02` |

### `encodeTargetPower(watts)` → 3 octets
`05`, puis la puissance en entier signé 16 bits (`setInt16(1, valeur, true)`), avec `valeur = clamp(Math.round(watts), -32768, 32767)`. Résolution : 1 W.

### `encodeSimulation(gradePct, { windMs = 0, crr = 0.004, cw = 0.51 } = {})` → 7 octets
| Position | Contenu | Format |
|---|---|---|
| 0 | `0x11` | |
| 1-2 | vent : `round(windMs × 1000)` | sint16, borné à ±32767/-32768 |
| 3-4 | pente : `round(gradePct × 100)` | sint16, borné de la même façon |
| 5 | roulement : `round(crr × 10000)` | uint8, borné de 0 à 255 |
| 6 | traînée : `round(cw × 100)` | uint8, borné de 0 à 255 |

### `decodeIndoorBikeData(dataView, { resistanceBytes = 1 } = {})` → objet
Lire `flags = getUint16(0, true)`, puis parcourir les champs **dans cet ordre** à partir de l'octet 2. Seuls les champs présents apparaissent dans le résultat. Attention : le bit 0 est **inversé**, le champ est présent quand ce bit vaut 0.

| Bit | Présent si | Clé | Lecture | Taille |
|---|---|---|---|---|
| 0 | bit à **0** | `speedKmh` | uint16 × 0.01 | 2 |
| 1 | bit à 1 | `avgSpeedKmh` | uint16 × 0.01 | 2 |
| 2 | bit à 1 | `cadenceRpm` | uint16 × 0.5 | 2 |
| 3 | bit à 1 | `avgCadenceRpm` | uint16 × 0.5 | 2 |
| 4 | bit à 1 | `distanceM` | uint24 : `getUint16(o, true) + getUint8(o + 2) × 65536` | 3 |
| 5 | bit à 1 | `resistanceLevel` | `getUint8` si `resistanceBytes` vaut 1, `getInt16(o, true)` s'il vaut 2 | `resistanceBytes` |
| 6 | bit à 1 | `powerW` | sint16 | 2 |
| 7 | bit à 1 | `avgPowerW` | sint16 | 2 |
| 8 | bit à 1 | `totalEnergyKcal` uint16, `energyPerHourKcal` uint16, `energyPerMinKcal` uint8 | | 5 |
| 9 | bit à 1 | `heartRateBpm` | uint8 | 1 |
| 10 | bit à 1 | `met` | uint8 × 0.1 | 1 |
| 11 | bit à 1 | `elapsedS` | uint16 | 2 |
| 12 | bit à 1 | `remainingS` | uint16 | 2 |

Le résultat contient toujours `truncated`, à `false` au départ. Avant de lire un champ, vérifier qu'il reste assez d'octets. Sinon, mettre `truncated` à `true` et retourner ce qui a déjà été lu, sans lancer d'erreur.

`resistanceBytes` existe parce que les sources se contredisent sur la taille de ce champ : la bonne valeur sera tranchée à l'étape 11, sur le vrai Hub.

### `decodeControlPointResponse(dataView)` → `{ requestOpcode, result, ok }` ou `null`
`null` si la trame fait moins de 3 octets ou si l'octet 0 n'est pas `0x80`. Sinon, `requestOpcode` = octet 1, `result` = octet 2, `ok` = `result === 1`.

## `src/core/hr-codec.js`

### `decodeHeartRate(dataView)` → `{ heartRateBpm, contactDetected, rrMs }`, avec `energyKj` si présent
Octet 0 = `flags`, lecture à partir de l'octet 1 :

1. Bit 0 : à 0, FC en uint8 ; à 1, FC en uint16.
2. `contactDetected` : `null` si le bit 2 vaut 0 (capteur non compatible), sinon `true` si le bit 1 vaut 1, `false` s'il vaut 0.
3. Bit 3 à 1 : `energyKj`, uint16. Sinon, cette clé n'existe pas.
4. Bit 4 à 1 : tous les uint16 restants sont des intervalles RR, en 1/1024 s. Les convertir en ms : `valeur × 1000 / 1024`. `rrMs` est un tableau, vide si le bit vaut 0.

## Tests à écrire dans `test/codecs.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`, avec :

```js
const dv = (bytes) => new DataView(Uint8Array.from(bytes).buffer);
const bytes = (u8) => [...u8];
```

**Encodage** : `assert.deepEqual(bytes(...), [...])`

| Appel | Octets (décimal) |
|---|---|
| `encodeRequestControl()` | `[0]` |
| `encodeStart()` | `[7]` |
| `encodeStop()` | `[8, 1]` |
| `encodePause()` | `[8, 2]` |
| `encodeTargetPower(200)` | `[5, 200, 0]` |
| `encodeTargetPower(250.4)` | `[5, 250, 0]` |
| `encodeTargetPower(0)` | `[5, 0, 0]` |
| `encodeTargetPower(-1)` | `[5, 255, 255]` |
| `encodeSimulation(5)` | `[17, 0, 0, 244, 1, 40, 51]` |
| `encodeSimulation(-5)` | `[17, 0, 0, 12, 254, 40, 51]` |
| `encodeSimulation(0)` | `[17, 0, 0, 0, 0, 40, 51]` |
| `encodeSimulation(16)` | `[17, 0, 0, 64, 6, 40, 51]` |
| `encodeSimulation(1.67)` | `[17, 0, 0, 167, 0, 40, 51]` |
| `encodeSimulation(5, { windMs: -2.5, crr: 0.005, cw: 0.6 })` | `[17, 60, 246, 244, 1, 50, 60]` |
| `encodeSimulation(0, { crr: 0.1, cw: 9 })` | `[17, 0, 0, 0, 0, 255, 255]` |

**decodeIndoorBikeData** : `assert.deepEqual` avec l'objet entier. Les trames sont en hexadécimal.

| Trame | Résultat |
|---|---|
| `[0x44, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0xC8, 0x00]` | `{ truncated: false, speedKmh: 10, cadenceRpm: 90, powerW: 200 }` |
| `[0x64, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0x05, 0xC8, 0x00]` | `{ truncated: false, speedKmh: 10, cadenceRpm: 90, resistanceLevel: 5, powerW: 200 }` |
| `[0x45, 0x00, 0xB4, 0x00, 0xC8, 0x00]` | `{ truncated: false, cadenceRpm: 90, powerW: 200 }` |
| `[0x01, 0x00]` | `{ truncated: false }` |
| `[0x41, 0x00, 0xF6, 0xFF]` | `{ truncated: false, powerW: -10 }` |
| `[0x44, 0x00, 0xE8, 0x03, 0xB4]` | `{ truncated: true, speedKmh: 10 }` |
| `[0x10, 0x00, 0xE8, 0x03, 0x01, 0x00, 0x01]` | `{ truncated: false, speedKmh: 10, distanceM: 65537 }` |

**Trame complète** : `[0xFF, 0x1F, 0xD0, 0x07, 0xA0, 0x00, 0x90, 0x00, 0x10, 0x27, 0x00, 0x0A, 0xFA, 0x00, 0xF0, 0x00, 0x64, 0x00, 0xE8, 0x03, 0x12, 0x8C, 0x2D, 0x3C, 0x00, 0x78, 0x00]` donne :

```js
{ truncated: false, avgSpeedKmh: 20, cadenceRpm: 80, avgCadenceRpm: 72, distanceM: 10000,
  resistanceLevel: 10, powerW: 250, avgPowerW: 240, totalEnergyKcal: 100,
  energyPerHourKcal: 1000, energyPerMinKcal: 18, heartRateBpm: 140, met: 4.5,
  elapsedS: 60, remainingS: 120 }
```

**Taille de la résistance**, avec la trame `[0x64, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0x05, 0x00, 0xC8, 0x00]`
- `{ resistanceBytes: 2 }` : `{ truncated: false, speedKmh: 10, cadenceRpm: 90, resistanceLevel: 5, powerW: 200 }`.
- Sans option : `powerW` vaut -14336. Ce test montre le décalage que provoquerait une mauvaise taille.

**decodeControlPointResponse**

| Trame | Résultat |
|---|---|
| `[0x80, 0x11, 0x01]` | `{ requestOpcode: 17, result: 1, ok: true }` |
| `[0x80, 0x05, 0x05]` | `{ requestOpcode: 5, result: 5, ok: false }` |
| `[0x12, 0x00, 0x01]` | `null` |
| `[0x80, 0x00]` | `null` |

**decodeHeartRate** : `assert.deepEqual` avec l'objet entier.

| Trame | Résultat |
|---|---|
| `[0x00, 72]` | `{ heartRateBpm: 72, contactDetected: null, rrMs: [] }` |
| `[0x01, 0x2C, 0x01]` | `{ heartRateBpm: 300, contactDetected: null, rrMs: [] }` |
| `[0x06, 80]` | `{ heartRateBpm: 80, contactDetected: true, rrMs: [] }` |
| `[0x04, 80]` | `{ heartRateBpm: 80, contactDetected: false, rrMs: [] }` |
| `[0x08, 90, 0x10, 0x00]` | `{ heartRateBpm: 90, contactDetected: null, energyKj: 16, rrMs: [] }` |
| `[0x10, 75, 0x00, 0x04, 0x00, 0x02]` | `{ heartRateBpm: 75, contactDetected: null, rrMs: [1000, 500] }` |
| `[0x19, 0x90, 0x00, 0x20, 0x00, 0x00, 0x04]` | `{ heartRateBpm: 144, contactDetected: null, energyKj: 32, rrMs: [1000] }` |

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec. Le test sur le vrai Hub arrive à l'étape 11.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de `navigator.bluetooth`, de connexion ni de file d'attente de commandes : c'est l'étape 11.
- Pas de DOM ni de dépendance npm.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
