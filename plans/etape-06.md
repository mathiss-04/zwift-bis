# Étape 6 — État de sortie

## Objectif

Écrire `src/core/ride.js` : il combine la physique et le parcours. À chaque pas de temps, il lit la pente à la position actuelle, fait évoluer la vitesse, avance sur le parcours et cumule le dénivelé positif. Le module est pur : chaque appel retourne un nouvel état.

## Fichiers à créer (et rien d'autre)

- `src/core/ride.js`
- `test/ride.test.js`

## Modules existants à utiliser

```js
import { stepSpeed } from './physics.js';
// stepSpeed(speedMs, powerW, grade, dtS, params) → nouvelle vitesse (m/s)
import { pointAt } from './route.js';
// pointAt(route, distanceM) → { lap, posM, x, z, alt, grade } (avec lat et lon s'ils existent)
```

## Fonctions, dans cet ordre

Toutes deux exportées, sans classe. Commenter en français.

### `createRide(route, params, startDistanceM = 0)` → état
`p = pointAt(route, startDistanceM)`, puis retourner :

```js
{
  route, params,
  timeS: 0,
  distanceM: Math.max(0, startDistanceM),
  speedMs: 0,
  ascentM: 0,
  point: p,
}
```

### `stepRide(state, powerW, dtS)` → état
1. Si `dtS <= 0` : retourner `state`.
2. La pente vient du point actuel : `grade = state.point.grade`.
3. `v = stepSpeed(state.speedMs, powerW, grade, dtS, state.params)`.
4. Distance, avec la vitesse moyenne du pas : `d = state.distanceM + (state.speedMs + v) / 2 × dtS`.
5. `p = pointAt(state.route, d)`.
6. Dénivelé : `ascentM = state.ascentM + max(0, p.alt − state.point.alt)`.
7. Retourner un nouvel état avec `timeS + dtS`, `distanceM: d`, `speedMs: v`, `ascentM`, `point: p`. Le `route` et le `params` restent les mêmes.

## Tests à écrire dans `test/ride.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`, avec ces éléments :

```js
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Fabrique un parcours de N points séparés de `step` mètres.
const makeRoute = (N, step, alt, grade, isLoop = true) => ({
  isLoop,
  lengthM: (N - 1) * step,
  stepM: step,
  x: Array.from({ length: N }, (_, i) => i * step),
  z: Array(N).fill(0),
  alt: Array.from({ length: N }, (_, i) => alt(i)),
  grade: Array.from({ length: N }, (_, i) => grade(i)),
});

// Enchaîne les pas de 0.05 s pendant durationS secondes.
function run(state, powerW, durationS, dtS = 0.05) {
  const n = Math.round(durationS / dtS);
  let s = state;
  for (let i = 0; i < n; i++) s = stepRide(s, powerW, dtS);
  return s;
}

const params = createParams(75, 8); // importé de physics.js
const FLAT = makeRoute(101, 10, () => 100, () => 0);             // boucle plate de 1000 m
const HILL = makeRoute(101, 10, (i) => 100 + i * 0.5, () => 0.05, false); // montée à 5 %, sans boucle
const PEAK = makeRoute(201, 10, (i) => 100 + (i <= 100 ? i : 200 - i), () => 0); // boucle de 2000 m : 100 m de D+, pente nulle
```

**Tableau principal.** Tolérances : `timeS` 0.001 ; `distanceM`, `ascentM`, `point.posM`, `point.alt` 0.001 ; `speedMs` 0.0001 ; `point.lap` en égalité stricte.

| Cas | timeS | distanceM | speedMs | ascentM | lap | posM | alt |
|---|---|---|---|---|---|---|---|
| `run(createRide(FLAT, params), 200, 60)` | 60 | 468.616 | 9.3330 | 0 | 0 | 468.616 | 100 |
| `run(createRide(FLAT, params), 200, 300)` | 300 | 2730.140 | 9.4287 | 0 | 2 | 730.140 | 100 |
| `run(createRide(FLAT, params), 0, 60)` | 60 | 0 | 0 | 0 | 0 | 0 | 100 |
| `run(createRide(HILL, params), 250, 60)` | 60 | 279.444 | 4.9941 | 13.972 | 0 | 279.444 | 113.972 |
| `run(createRide(HILL, params), 0, 10)` | 10 | 0 | 0 | 0 | 0 | 0 | 100 |
| `run(createRide(PEAK, params), 200, 600)` | 600 | 5558.757 | 9.4287 | 299.939 | 2 | 1558.757 | 144.124 |
| `createRide(FLAT, params, 250)` | 0 | 250 | 0 | 0 | 0 | 250 | 100 |
| `run(createRide(FLAT, params, 250), 200, 60)` | 60 | 718.616 | 9.3330 | 0 | 0 | 718.616 | 100 |
| `stepRide(createRide(FLAT, params), 200, 0.05)` | 0.05 | 0.003 | 0.1135 | 0 | 0 | 0.003 | 100 |

**Durée nulle** : `const s = createRide(FLAT, params); stepRide(s, 200, 0) === s` est vrai.

**Pas de modification de l'état reçu** : après `stepRide(s, 200, 1)`, `s.timeS` vaut toujours 0.

**La vitesse ne saute pas** : à partir de `run(createRide(FLAT, params), 200, 60)`, vingt pas de 0.05 s avec 1000 W ; la vitesse augmente à chaque pas, jamais de plus de 0.05 m/s.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de difficulté ni de commande au trainer : c'est l'étape 7. La physique utilise toujours la pente réelle.
- Pas de minuteur (`setInterval`) ni de boucle : c'est l'étape 10.
- Pas de séance ERG ni d'enregistrement : ce sont les étapes 23 et 25.
- Pas de DOM, de Bluetooth ni de dépendance npm. Les seuls imports sont `physics.js` et `route.js`.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
