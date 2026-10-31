# Étape 2 — Statistiques et zones

## Objectif

Écrire deux petits modules purs. `stats.js` calcule la moyenne de puissance sur quelques secondes, la puissance normalisée et le dénivelé positif. `zones.js` donne la zone de puissance à partir de la FTP. Ni écran ni Bluetooth : uniquement des fonctions.

## Fichiers à créer (et rien d'autre)

- `src/core/stats.js`
- `src/core/zones.js`
- `test/stats-zones.test.js`

## Conventions

Puissance en W, altitude en m. Les tableaux de puissance contiennent une valeur par seconde (1 Hz). Exporter avec `export`. Commenter en français, avec la formule.

## `src/core/stats.js`

### `mean(values)` → nombre
Somme des valeurs divisée par leur nombre. Tableau vide : `0`.

### `trailingAverage(values, n = 3)` → nombre
Moyenne des `n` dernières valeurs : `mean(values.slice(-n))`. S'il y en a moins de `n`, moyenne de celles qui existent. Sert à la « puissance 3 s ».

### `normalizedPower(powers)` → W
1. Moins de 30 valeurs : retourner `0`.
2. Calculer la moyenne glissante sur 30 valeurs, pour chaque fenêtre complète (la première couvre les indices 0 à 29). Tenir une somme courante : ajouter la nouvelle valeur et retirer celle qui sort de la fenêtre.
3. Élever chaque moyenne à la puissance 4, puis faire la moyenne de ces résultats.
4. Retourner la racine quatrième : `Math.pow(moyenne, 0.25)`.

### `ascentM(altitudes)` → m
Somme des montées entre deux points consécutifs : on ajoute `altitudes[i] - altitudes[i - 1]` seulement si c'est positif. Moins de 2 points : `0`.

## `src/core/zones.js`

### Constante `ZONES`
Exporter exactement ce tableau, avec ce commentaire au-dessus : `// maxFraction : limite haute exclue, en fraction de la FTP.`

```js
export const ZONES = [
  { zone: 1, name: 'Récupération', maxFraction: 0.60, color: '#808080' },
  { zone: 2, name: 'Endurance', maxFraction: 0.76, color: '#3b82f6' },
  { zone: 3, name: 'Tempo', maxFraction: 0.90, color: '#22c55e' },
  { zone: 4, name: 'Seuil', maxFraction: 1.05, color: '#eab308' },
  { zone: 5, name: 'VO2 max', maxFraction: 1.19, color: '#f97316' },
  { zone: 6, name: 'Anaérobie', maxFraction: Infinity, color: '#ef4444' },
];
```

### `zoneForPower(powerW, ftpW)` → un élément de `ZONES`
1. Si `ftpW <= 0` : retourner `ZONES[0]`.
2. `f = powerW / ftpW`.
3. Retourner le premier élément tel que `f < maxFraction`.

### `zoneRangeW(zone, ftpW)` → `{ minW, maxW }`
`zone` est le numéro, de 1 à 6.
- `minW` = 0 pour la zone 1, sinon `ZONES[zone - 2].maxFraction × ftpW`.
- `maxW` = `ZONES[zone - 1].maxFraction × ftpW`, ou `Infinity` pour la zone 6.

## Tests à écrire dans `test/stats-zones.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`, avec cet utilitaire et ce raccourci :

```js
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}
const fill = (n, v) => Array(n).fill(v);
```

**mean** : `[]` → 0 ; `[100, 200, 300]` → 200.

**trailingAverage** (égalité stricte)

| Appel | Attendu |
|---|---|
| `trailingAverage([100, 200, 300, 400])` | 300 |
| `trailingAverage([100, 200])` | 150 |
| `trailingAverage([])` | 0 |
| `trailingAverage([100, 200, 300, 400, 500], 5)` | 300 |

**normalizedPower** (tolérance 0.001)

| Série | Attendu | Moyenne simple, pour comparer |
|---|---|---|
| `[]` | 0 | |
| `fill(29, 200)` | 0 | |
| `fill(30, 200)` | 200 | 200 |
| `[...fill(600, 150), ...fill(600, 300)]` | 255.677 | 225 |
| 10 fois `[...fill(60, 300), ...fill(60, 100)]` | 239.372 | 200 |
| `Array.from({ length: 60 }, (_, i) => 100 + i * 5)` | 258.924 | 247.5 |

**ascentM** (égalité stricte) : `[]` → 0 ; `[100]` → 0 ; `[100, 90, 80]` → 0 ; `[100, 110, 105, 120, 120, 90]` → 25.

**zoneForPower**, avec `ftpW = 200` (comparer le champ `.zone`)

| Puissance (W) | Zone |
|---|---|
| 0 | 1 |
| 119 | 1 |
| 120 | 2 |
| 151 | 2 |
| 152 | 3 |
| 179 | 3 |
| 180 | 4 |
| 209 | 4 |
| 210 | 5 |
| 237 | 5 |
| 238 | 6 |
| 1000 | 6 |

Et `zoneForPower(500, 0).zone` = 1.

**zoneRangeW**, avec `ftpW = 200` (tolérance 0.001) : zone 1 → `{ minW: 0, maxW: 120 }` ; zone 4 → `{ minW: 180, maxW: 210 }` ; zone 6 → `minW` 238 et `maxW` strictement égal à `Infinity`.

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification de `physics.js`, `package.json`, `AGENTS.md` ou `docs/`.
- Pas de classe, d'import, de dépendance npm, de DOM ni de Bluetooth dans `stats.js` et `zones.js`.
- Pas d'enregistrement de la sortie : c'est l'étape 25.
- Pas d'affichage des couleurs : c'est l'étape 22.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification de la formule, s'arrêter et le signaler.
