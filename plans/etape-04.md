# Étape 4 — Déroulé de séance

## Objectif

Écrire `src/core/workout.js` : à partir de la liste de blocs produite par `zwo.js`, il dit à tout instant quel bloc est en cours, quelle puissance viser et combien de temps il reste. Il gère aussi la pause et l'ajustement de l'intensité par pas de 5 %. Le module est pur : chaque fonction retourne un nouvel état et ne modifie jamais celui qu'elle reçoit.

## Fichiers à créer (et rien d'autre)

- `src/core/workout.js`
- `test/workout.test.js`

## Données d'entrée

Un bloc a cette forme (déjà produite par `parseZwo`) :

```js
{ source: 'Warmup', type: 'ramp', durationS: 100, powerStart: 0.5, powerEnd: 1 }
```

`type` vaut `'steady'`, `'ramp'` ou `'free'`. Les puissances sont des fractions de la FTP, ou `null` pour `'free'`.

## Constantes

```js
export const INTENSITY_STEP = 0.05;  // un appui = 5 %
export const MAX_INTENSITY_STEPS = 10; // limite : ±50 %
```

## Fonctions, dans cet ordre

Toutes exportées, sans classe ni import. Commenter en français.

### `createWorkout(blocks, ftpW)` → état
`{ blocks, ftpW, elapsedS: 0, paused: false, intensitySteps: 0 }`.
Le nombre d'appuis est un entier : on évite ainsi d'accumuler des erreurs d'arrondi sur 0.05.

### `totalDurationS(blocks)` → s
Somme des `durationS`.

### `blockAt(blocks, tS)` → `{ index, block, inBlockS, remainingS }` ou `null`
Parcourir les blocs en cumulant leur durée. Un instant `t` appartient au bloc si `début <= t < fin` : le début d'un bloc lui appartient, sa fin appartient au suivant. `t` négatif est traité comme 0. `inBlockS = t - début`, `remainingS = fin - t`. Après la fin de la séance : `null`.

### `targetFraction(block, inBlockS)` → fraction ou `null`
`null` si `block.type === 'free'`. Sinon, interpolation linéaire :
`powerStart + (powerEnd - powerStart) × inBlockS / durationS`.

### `intensityFactor(state)` → nombre
`1 + INTENSITY_STEP × state.intensitySteps`.

### `targetPowerW(state)` → W entier ou `null`
1. `a = blockAt(state.blocks, state.elapsedS)`. Si `null` : retourner `null`.
2. `f = targetFraction(a.block, a.inBlockS)`. Si `null` : retourner `null`.
3. Retourner `Math.round(f × state.ftpW × intensityFactor(state))`.

### `advance(state, dtS)` → état
Si `state.paused` : retourner `state`. Sinon, un nouvel état où
`elapsedS = min(elapsedS + max(0, dtS), totalDurationS(blocks))`.

### `pause(state)` et `resume(state)` → état
Nouvel état avec `paused` à `true` ou à `false`.

### `adjustIntensity(state, deltaSteps)` → état
Nouvel état où `intensitySteps = state.intensitySteps + deltaSteps`, borné entre `-MAX_INTENSITY_STEPS` et `MAX_INTENSITY_STEPS`.

### `isFinished(state)` → booléen
`state.elapsedS >= totalDurationS(state.blocks)`.

## Tests à écrire dans `test/workout.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`, avec cette séance (230 s au total) et `ftpW = 200` :

```js
const BLOCKS = [
  { source: 'Warmup', type: 'ramp', durationS: 100, powerStart: 0.5, powerEnd: 1 },
  { source: 'SteadyState', type: 'steady', durationS: 60, powerStart: 0.8, powerEnd: 0.8 },
  { source: 'FreeRide', type: 'free', durationS: 30, powerStart: null, powerEnd: null },
  { source: 'Cooldown', type: 'ramp', durationS: 40, powerStart: 1, powerEnd: 0.6 },
];
const at = (tS) => ({ ...createWorkout(BLOCKS, 200), elapsedS: tS });
```

**createWorkout** : `assert.deepEqual` avec `{ blocks: BLOCKS, ftpW: 200, elapsedS: 0, paused: false, intensitySteps: 0 }`.

**totalDurationS** : `totalDurationS(BLOCKS)` = 230.

**blockAt, targetPowerW et isFinished** : pour chaque ligne, vérifier `blockAt(BLOCKS, t)` (les 3 champs), `targetPowerW(at(t))` et `isFinished(at(t))`.

| t | index | inBlockS | remainingS | targetPowerW | isFinished |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 100 | 100 | false |
| 50 | 0 | 50 | 50 | 150 | false |
| 99.5 | 0 | 99.5 | 0.5 | 200 | false |
| 100 | 1 | 0 | 60 | 160 | false |
| 159 | 1 | 59 | 1 | 160 | false |
| 160 | 2 | 0 | 30 | null | false |
| 189 | 2 | 29 | 1 | null | false |
| 190 | 3 | 0 | 40 | 200 | false |
| 210 | 3 | 20 | 20 | 160 | false |
| 229 | 3 | 39 | 1 | 122 | false |
| 230 | bloc `null` | | | null | true |
| 500 | bloc `null` | | | null | true |

Et `blockAt(BLOCKS, -5).index` = 0, avec `inBlockS` = 0.

**targetFraction** (égalité stricte)

| Bloc | inBlockS | Attendu |
|---|---|---|
| `BLOCKS[0]` | 0 | 0.5 |
| `BLOCKS[0]` | 25 | 0.625 |
| `BLOCKS[1]` | 30 | 0.8 |
| `BLOCKS[2]` | 10 | null |
| `BLOCKS[3]` | 10 | 0.9 |

**Intensité**, à partir de `advance(createWorkout(BLOCKS, 200), 120)`, soit t = 120 dans le bloc à 160 W

| Après | intensitySteps | targetPowerW |
|---|---|---|
| départ | 0 | 160 |
| `adjustIntensity(s, 1)` | 1 | 168 |
| puis `adjustIntensity(s, -3)` | -2 | 144 |

**Bornes de l'intensité** : à partir de `createWorkout(BLOCKS, 200)`, `adjustIntensity(s, 99).intensitySteps` = 10 et `adjustIntensity(s, -99).intensitySteps` = -10. Après `advance(..., 120)` : 240 W pour +99, 80 W pour -99.

**Pause** : `advance(createWorkout(BLOCKS, 200), 10)`, puis `pause`, puis `advance(s, 50)` : `elapsedS` reste 10. Puis `resume`, puis `advance(s, 5)` : `elapsedS` = 15 et `paused` = false.

**advance**
- `advance(createWorkout(BLOCKS, 200), 9999).elapsedS` = 230 : on ne dépasse pas la fin.
- `advance(advance(createWorkout(BLOCKS, 200), 10), -5).elapsedS` = 10 : le temps ne recule pas.
- Vingt appels `advance(s, 0.05)` donnent `elapsedS` = 1 à 0.000001 près.

**Pas de modification de l'état reçu** : `const s = createWorkout(BLOCKS, 200); advance(s, 50);` laisse `s.elapsedS` à 0.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Ne pas importer `zwo.js` : `totalDurationS` est volontairement défini ici aussi, pour garder ce module autonome.
- Pas d'envoi de commande au trainer : c'est l'étape 7.
- Pas d'affichage ni de graphique : ce sont les étapes 23 et 24.
- Pas de DOM, de Bluetooth, de minuteur (`setInterval`) ni de dépendance npm.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
