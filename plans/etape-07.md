# Étape 7 — Commande de résistance

## Objectif

Écrire `src/core/resistance.js` : il décide quelle consigne envoyer au home-trainer, une pente ou une puissance. En sortie libre, le trainer reçoit la pente réelle réduite par la difficulté, bornée à ±16 %. En séance, il reçoit la puissance cible. Pendant un bloc FreeRide, il n'y a pas de cible : il repasse sur la pente. La physique de la vitesse n'est jamais concernée par ce module.

## Fichiers à créer (et rien d'autre)

- `src/core/resistance.js`
- `test/resistance.test.js`

## Conventions

`grade` est une fraction (0.05 = 5 %). `gradePct` est en pourcent, car c'est l'unité attendue par `setGrade`. `difficulty` va de 0 à 1 (0.5 = 50 %). Une consigne est un objet :

```js
{ type: 'grade', gradePct: 5 }
{ type: 'power', watts: 200 }
```

## Constantes

```js
export const DEFAULT_DIFFICULTY = 0.5;
export const MAX_GRADE_PCT = 16;
```

## Fonctions, dans cet ordre

Toutes exportées, sans classe ni import. Commenter en français.

### `clampDifficulty(difficulty)` → nombre
Borne la valeur entre 0 et 1.

### `gradeCommand(grade, difficulty)` → consigne
1. `pct = grade × 100 × clampDifficulty(difficulty)`.
2. Borner `pct` entre `-MAX_GRADE_PCT` et `MAX_GRADE_PCT`.
3. Arrondir à 0,01 % près, ce qui correspond à la précision du protocole : `Math.round(pct * 100) / 100 + 0`. Le `+ 0` transforme un éventuel `-0` en `0`.
4. Retourner `{ type: 'grade', gradePct }`.

La difficulté s'applique avant la borne : une pente de 40 % à 50 % de difficulté donne 20 %, donc 16 %.

### `powerCommand(watts)` → consigne
`{ type: 'power', watts: Math.max(0, Math.round(watts)) }`.

### `commandFor({ mode, grade, difficulty, targetW })` → consigne
`mode` vaut `'free'` ou `'erg'`.
- Si `mode === 'erg'` et que `targetW` n'est ni `null` ni `undefined` : `powerCommand(targetW)`. Une cible de 0 W reste une cible.
- Sinon : `gradeCommand(grade, difficulty)`.

### `sameCommand(a, b)` → booléen
Permet de ne pas renvoyer une consigne identique. `false` si `a` ou `b` est `null` ou `undefined`, ou si leurs `type` diffèrent. Sinon, compare `gradePct` pour le type `'grade'` et `watts` pour le type `'power'`.

## Tests à écrire dans `test/resistance.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`. Utiliser `node:test` et `node:assert/strict`, et `assert.deepEqual` pour comparer les consignes.

**Constantes** : `DEFAULT_DIFFICULTY` = 0.5, `MAX_GRADE_PCT` = 16.

**clampDifficulty** : `-1` → 0, `0.3` → 0.3, `1.5` → 1.

**gradeCommand** : le champ `gradePct` attendu

| grade | difficulty | gradePct |
|---|---|---|
| 0.1 | 0.5 | 5 |
| 0.05 | 1 | 5 |
| 0.05 | 0 | 0 |
| 0.2 | 1 | 16 |
| 0.4 | 0.5 | 16 |
| 0.4 | 1 | 16 |
| -0.2 | 1 | -16 |
| -0.1 | 0.5 | -5 |
| 0.0333 | 0.5 | 1.67 |
| 0.07 | 0.33 | 2.31 |
| 0.1 | 1.5 | 10 |
| 0.1 | -1 | 0 |
| 0 | 0.5 | 0 |
| -0.001 | 0 | 0 |

Pour la dernière ligne, vérifier aussi `Object.is(gradePct, 0)` : pas de `-0`.

**powerCommand** : le champ `watts` attendu : `200` → 200, `199.6` → 200, `-5` → 0, `0` → 0.

**commandFor**

| mode | grade | difficulty | targetW | Résultat |
|---|---|---|---|---|
| `'free'` | 0.1 | 0.5 | 200 | `{ type: 'grade', gradePct: 5 }` |
| `'erg'` | 0.1 | 0.5 | 200 | `{ type: 'power', watts: 200 }` |
| `'erg'` | 0.1 | 0.5 | `null` | `{ type: 'grade', gradePct: 5 }` |
| `'erg'` | 0.1 | 0.5 | absent | `{ type: 'grade', gradePct: 5 }` |
| `'erg'` | 0.1 | 0.5 | 0 | `{ type: 'power', watts: 0 }` |

**sameCommand**

| a | b | Résultat |
|---|---|---|
| `{ type: 'grade', gradePct: 5 }` | `{ type: 'grade', gradePct: 5 }` | true |
| `{ type: 'grade', gradePct: 5 }` | `{ type: 'grade', gradePct: 6 }` | false |
| `{ type: 'power', watts: 200 }` | `{ type: 'power', watts: 200 }` | true |
| `{ type: 'power', watts: 200 }` | `{ type: 'power', watts: 201 }` | false |
| `{ type: 'grade', gradePct: 5 }` | `{ type: 'power', watts: 5 }` | false |
| `null` | `{ type: 'power', watts: 5 }` | false |
| `{ type: 'power', watts: 5 }` | `undefined` | false |

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas d'octets ni de format Bluetooth : c'est l'étape 8.
- Pas d'envoi au trainer ni de file d'attente : ce sont les étapes 11 à 13.
- Pas de réglage de difficulté à l'écran : il arrive avec l'interface.
- Pas de DOM, de Bluetooth ni de dépendance npm.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
