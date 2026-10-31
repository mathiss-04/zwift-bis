# Étape 1 — Module physique

## Objectif

Écrire `src/core/physics.js` : à partir de la puissance et de la pente, il calcule les forces et fait évoluer la vitesse du cycliste. Le module est pur : pas d'écran, pas de Bluetooth, uniquement des fonctions. Les tests prouvent le résultat avec des valeurs chiffrées (plat, montée, descente).

## Fichiers à créer (et rien d'autre)

- `package.json`
- `src/core/physics.js`
- `test/physics.test.js`

Contenu exact de `package.json` :

```json
{
  "name": "zwift-bis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

## Conventions

Unités SI : masse en kg, force en N, vitesse en m/s, puissance en W, temps en s. La pente `grade` est une **fraction** : 0.05 = 5 %, négative en descente. Exporter toutes les fonctions et les deux constantes avec `export`. Commenter chaque fonction en français, avec la formule.

## Constantes

```js
export const SPEED_FLOOR_MS = 1;    // vitesse plancher pour le calcul P/v (m/s)
export const MAX_SUBSTEP_S = 0.1;   // durée maximale d'un pas de calcul (s)
```

## Fonctions, dans cet ordre

### `createParams(riderKg, bikeKg, overrides = {})`
Retourne un objet : `{ g: 9.81, rho: 1.225, crr: 0.004, cda: 0.32, eta: 0.975, rotatingMassKg: 1.5, ...overrides, massKg: riderKg + bikeKg }`.
Rôles : `g` pesanteur (m/s²), `rho` densité de l'air (kg/m³), `crr` roulement (sans unité), `cda` surface aérodynamique (m²), `eta` rendement de transmission, `rotatingMassKg` masse équivalente des roues.

### `gravityForce(massKg, grade, g)` → N
`F = massKg × g × sin(atan(grade))`. Positive en montée, négative en descente.

### `rollingForce(massKg, grade, crr, g)` → N
`F = crr × massKg × g × cos(atan(grade))`. Toujours positive.

### `dragForce(speedMs, cda, rho)` → N
`F = 0.5 × rho × cda × speedMs²`. Pas de vent.

### `totalResistance(speedMs, grade, params)` → N
Somme des trois forces ci-dessus, avec `params.massKg`, `params.g`, `params.crr`, `params.cda`, `params.rho`.

### `powerForSpeed(speedMs, grade, params)` → W
Puissance au pédalier nécessaire pour tenir cette vitesse :
`P = totalResistance(speedMs, grade, params) × speedMs / params.eta`. Peut être négative en descente.

### `steadySpeed(powerW, grade, params)` → m/s
Vitesse stabilisée, trouvée par dichotomie :
1. `P = max(0, powerW)`, `lo = 0`, `hi = 1`.
2. Tant que `powerForSpeed(hi, grade, params) <= P` et `hi < 200` : `hi = hi × 2`.
3. Répéter 60 fois : `mid = (lo + hi) / 2` ; si `powerForSpeed(mid, grade, params) > P` alors `hi = mid`, sinon `lo = mid`.
4. Retourner `(lo + hi) / 2`.

### `acceleration(speedMs, powerW, grade, params)` → m/s²
1. `P = max(0, powerW)`.
2. Force motrice : `drive = params.eta × P / max(speedMs, SPEED_FLOOR_MS)`.
3. `a = (drive − totalResistance(speedMs, grade, params)) / (params.massKg + params.rotatingMassKg)`.

Le plancher évite une division par zéro au démarrage.

### `stepSpeed(speedMs, powerW, grade, dtS, params)` → m/s
Fait avancer la vitesse de `dtS` secondes (méthode d'Euler) :
1. `n = max(1, ceil(dtS / MAX_SUBSTEP_S))`, `h = dtS / n`.
2. `v = speedMs`. Répéter `n` fois : `v = max(0, v + acceleration(v, powerW, grade, params) × h)`.
3. Retourner `v`. La vitesse n'est jamais négative : pas de recul.

## Tests à écrire dans `test/physics.test.js`

Utiliser `node:test` et `node:assert/strict`, avec cet utilitaire :

```js
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}
```

Dans tous les tests : `const p = createParams(75, 8);` (83 kg au total), sauf mention contraire.

**createParams** : `p.massKg` = 83, `p.cda` = 0.32 ; `createParams(75, 8, { cda: 0.25 }).cda` = 0.25.

**Forces** (tolérance 0.001)

| Appel | Attendu |
|---|---|
| `gravityForce(83, 0, 9.81)` | 0 |
| `gravityForce(83, 0.05, 9.81)` | 40.661 |
| `gravityForce(83, 0.10, 9.81)` | 81.019 |
| `gravityForce(83, -0.05, 9.81)` | -40.661 |
| `rollingForce(83, 0, 0.004, 9.81)` | 3.257 |
| `rollingForce(83, 0.05, 0.004, 9.81)` | 3.253 |
| `rollingForce(83, 0.10, 0.004, 9.81)` | 3.241 |
| `dragForce(0, 0.32, 1.225)` | 0 |
| `dragForce(10, 0.32, 1.225)` | 19.600 |
| `dragForce(15, 0.32, 1.225)` | 44.100 |
| `totalResistance(10, 0, p)` | 22.857 |
| `totalResistance(10, 0.05, p)` | 63.514 |
| `totalResistance(10, -0.05, p)` | -17.808 |

**powerForSpeed** (tolérance 0.001) : `(10, 0)` → 234.430 ; `(5, 0.05)` → 250.326 ; `(20, -0.05)` → 840.865.

**steadySpeed** (tolérance 0.001 m/s)

| Puissance (W) | Pente | Attendu (m/s) | Soit (km/h) |
|---|---|---|---|
| 100 | 0 | 7.226 | 26.0 |
| 200 | 0 | 9.429 | 33.9 |
| 300 | 0 | 10.943 | 39.4 |
| 200 | 0.05 | 4.127 | 14.9 |
| 250 | 0.05 | 4.995 | 18.0 |
| 300 | 0.10 | 3.381 | 12.2 |
| 0 | 0 | 0 | 0 |
| -50 | 0 | 0 | 0 |
| 0 | -0.002 | 0 | 0 (le roulement retient) |
| 0 | -0.05 | 13.815 | 49.7 (vitesse limite) |
| 0 | -0.10 | 19.921 | 71.7 (vitesse limite) |
| 200 | -0.05 | 15.917 | 57.3 |

Aller-retour : pour 200 W à 0 et 250 W à 0.05, `powerForSpeed(steadySpeed(w, g, p), g, p)` redonne `w` (tolérance 0.001).

**acceleration** (tolérance 0.0001)

| Vitesse | Puissance | Pente | Attendu |
|---|---|---|---|
| 0 | 200 | 0 | 2.2692 |
| 10 | 200 | 0 | -0.0397 |
| 10 | 0 | 0 | -0.2705 |
| 10 | -100 | 0 | -0.2705 |
| 0 | 0 | -0.05 | 0.4427 |

**stepSpeed, un appel** (tolérance 0.0001)

| Appel | Attendu | Ce que cela vérifie |
|---|---|---|
| `stepSpeed(10, 200, 0, 0, p)` | 10 | durée nulle |
| `stepSpeed(0, 0, 0, 0.05, p)` | 0 | reste à l'arrêt |
| `stepSpeed(0, 0, 0.05, 1, p)` | 0 | pas de recul en montée |
| `stepSpeed(0, 0, -0.05, 1, p)` | 0.4426 | démarre seul en descente |
| `stepSpeed(10, 200, 0, 0.05, p)` | 9.9980 | un pas |
| `stepSpeed(10, 200, 0, 1, p)` | 9.9615 | découpage en 10 pas |

**Simulation** : appeler `stepSpeed` en boucle avec `dtS = 0.05`, pendant la durée indiquée (tolérance 0.002 m/s).

| Vitesse initiale | Puissance | Pente | Durée (s) | Attendu (m/s) |
|---|---|---|---|---|
| 0 | 200 | 0 | 10 | 6.132 |
| 0 | 200 | 0 | 60 | 9.333 |
| 0 | 200 | 0 | 300 | 9.429 |
| 15 | 0 | 0 | 30 | 6.659 |
| 15 | 0 | 0 | 60 | 3.704 |
| 0 | 0 | -0.05 | 10 | 4.282 |
| 0 | 0 | -0.05 | 300 | 13.815 |
| 0 | 0 | -0.10 | 300 | 19.921 |
| 12 | 250 | 0.05 | 120 | 4.995 |

**Inertie** : partir de 10 m/s, à plat, avec 1000 W, `dtS = 0.05`, pendant 100 pas. La vitesse augmente à chaque pas, et n'augmente jamais de plus de 0.05 m/s en un pas.

## Vérification par l'utilisateur

Depuis la racine du projet :

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec. Puis :

```bash
node --input-type=module -e "import {createParams,steadySpeed} from './src/core/physics.js'; const p=createParams(75,8); console.log((steadySpeed(200,0,p)*3.6).toFixed(1), (steadySpeed(250,0.05,p)*3.6).toFixed(1), (steadySpeed(0,-0.10,p)*3.6).toFixed(1))"
```

Résultat attendu : `33.9 18.0 71.7` (km/h : 200 W à plat, 250 W à 5 %, roue libre à −10 %).

## Ne pas faire

- Aucun autre fichier : pas de `index.html`, de serveur, de `.gitignore`, ni de modification de `AGENTS.md` ou de `docs/`.
- Pas de distance, de position, de parcours ni de tour : c'est l'étape 6.
- Pas de réglage de difficulté ni de commande au trainer : c'est l'étape 7.
- Pas d'estimation du CdA depuis la taille : c'est l'étape 21.
- Pas de vent, de freinage, de lissage de la puissance ni de limite de pente.
- Pas de `class`, d'import, de dépendance npm, de DOM ni de Bluetooth dans `physics.js`.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification de la formule, s'arrêter et le signaler à l'utilisateur.
