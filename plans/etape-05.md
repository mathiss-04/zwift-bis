# Étape 5 — Parcours en mémoire

## Objectif

Écrire `src/core/route.js` : à partir d'un parcours déjà chargé, il donne la position, l'altitude et la pente à n'importe quelle distance, et compte les tours sur une boucle. Le module est pur : il ne lit aucun fichier.

## Fichiers à créer (et rien d'autre)

- `src/core/route.js`
- `test/route.test.js`

## Format d'un parcours

```js
{
  isLoop: true,      // true : le parcours se répète ; le dernier point rejoint le premier
  lengthM: 40,       // longueur d'un tour (m)
  stepM: 10,         // distance constante entre deux points (m)
  x: [], z: [],      // position (m)
  alt: [],           // altitude (m)
  grade: [],         // pente en fraction : 0.05 = 5 %
  lat: [], lon: [],  // facultatifs : latitude et longitude (degrés)
}
```

Le point `i` se trouve à la distance `i × stepM`. Le pas constant permet de trouver le bon point par un simple calcul, sans parcourir le tableau.

## Fonctions, dans cet ordre

Toutes exportées, sans classe ni import. Commenter en français.

### `validateRoute(route)` → `route`
Vérifie dans cet ordre, et lance une `Error` avec le message exact au premier problème :

1. `route.stepM` n'est pas `> 0` : `Parcours invalide : stepM doit être positif`
2. `alt` absent ou moins de 2 points : `Parcours invalide : au moins 2 points requis`
3. Pour chaque colonne de `['x', 'z', 'alt', 'grade']`, si ce n'est pas un tableau de la même longueur que `alt` : `` `Parcours invalide : colonne ${colonne} de mauvaise longueur` ``
4. `|lengthM − (n − 1) × stepM| > 0.001`, avec `n` le nombre de points : `Parcours invalide : lengthM ne correspond pas à stepM`

Sans problème, retourne `route`.

### `locate(route, distanceM)` → `{ lap, posM }`
1. `d = max(0, distanceM)`.
2. Boucle : `lap = floor(d / lengthM)`, `posM = d − lap × lengthM`.
3. Sinon : `lap = 0`, `posM = min(d, lengthM)`.

### `lerp(a, b, t)` → nombre
`a + (b − a) × t`.

### `pointAt(route, distanceM)` → `{ lap, posM, x, z, alt, grade }`
1. `{ lap, posM } = locate(route, distanceM)`.
2. `i = min(floor(posM / stepM), n − 2)`, avec `n` le nombre de points. Ce `min` garde un segment valide tout au bout d'un parcours sans boucle.
3. `t = posM / stepM − i`.
4. Pour `x`, `z`, `alt` et `grade` : `lerp(colonne[i], colonne[i + 1], t)`.
5. Si `route.lat` et `route.lon` existent : ajouter `lat` et `lon`, calculés de la même façon. Sinon, ces deux champs n'existent pas dans le résultat.

## Tests à écrire dans `test/route.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`, avec l'utilitaire `near` et ces données :

```js
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

const LOOP = {
  isLoop: true,
  lengthM: 40,
  stepM: 10,
  x: [0, 10, 10, 0, 0],
  z: [0, 0, -10, -10, 0],
  alt: [100, 101, 103, 101, 100],
  grade: [0.1, 0.2, 0, -0.2, 0.1],
};
const LINE = { ...LOOP, isLoop: false };
```

**pointAt sur la boucle** : `lap` en égalité stricte, le reste avec une tolérance de 0.000001.

| Distance | lap | posM | x | z | alt | grade |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 100 | 0.1 |
| 5 | 0 | 5 | 5 | 0 | 100.5 | 0.15 |
| 10 | 0 | 10 | 10 | 0 | 101 | 0.2 |
| 12.5 | 0 | 12.5 | 10 | -2.5 | 101.5 | 0.15 |
| 25 | 0 | 25 | 5 | -10 | 102 | -0.1 |
| 39 | 0 | 39 | 0 | -1 | 100.1 | 0.07 |
| 40 | 1 | 0 | 0 | 0 | 100 | 0.1 |
| 45 | 1 | 5 | 5 | 0 | 100.5 | 0.15 |
| 80 | 2 | 0 | 0 | 0 | 100 | 0.1 |
| 92.5 | 2 | 12.5 | 10 | -2.5 | 101.5 | 0.15 |
| -3 | 0 | 0 | 0 | 0 | 100 | 0.1 |
| 1000000.5 | 25000 | 0.5 | 0.5 | 0 | 100.05 | 0.105 |

**pointAt sans boucle** (mêmes tolérances)

| Distance | lap | posM | x | z | alt | grade |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 100 | 0.1 |
| 25 | 0 | 25 | 5 | -10 | 102 | -0.1 |
| 40 | 0 | 40 | 0 | 0 | 100 | 0.1 |
| 99 | 0 | 40 | 0 | 0 | 100 | 0.1 |

**Latitude et longitude** : avec `{ ...LOOP, lat: [45, 45.1, 45.2, 45.1, 45], lon: [5, 5, 5.1, 5.1, 5] }`, à la distance 5 : `lat` 45.05 et `lon` 5 ; à la distance 12.5 : `lat` 45.125 et `lon` 5.025 (tolérance 0.000001). Avec `LOOP`, `'lat' in pointAt(LOOP, 5)` vaut `false`.

**lerp** : `lerp(10, 20, 0)` = 10, `lerp(10, 20, 0.5)` = 15, `lerp(10, 20, 1)` = 20.

**validateRoute** : `validateRoute(LOOP) === LOOP` est vrai. Puis, avec `assert.throws(() => ..., { message: '...' })` :

| Entrée | Message exact |
|---|---|
| `{ ...LOOP, stepM: 0 }` | `Parcours invalide : stepM doit être positif` |
| `{ ...LOOP, alt: [1], x: [1], z: [1], grade: [1] }` | `Parcours invalide : au moins 2 points requis` |
| `{ ...LOOP, grade: [1, 2] }` | `Parcours invalide : colonne grade de mauvaise longueur` |
| `{ ...LOOP, lengthM: 50 }` | `Parcours invalide : lengthM ne correspond pas à stepM` |

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de lecture de `route.json` ni de `fetch` : c'est l'étape 20.
- Pas de préparation de GPX ni de calcul de pente : ce sont les étapes 16 à 18.
- Pas de physique, de vitesse ni d'état de sortie : c'est l'étape 6.
- Pas de DOM, de Bluetooth ni de dépendance npm.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
