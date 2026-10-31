# Étape 3 — Lecture des fichiers .zwo

## Objectif

Écrire `src/core/zwo.js` : à partir du texte d'un fichier de séance Zwift (.zwo, du XML), il produit une liste de blocs au format unique. L'analyseur est écrit à la main avec des expressions régulières, pour tourner sous Node sans DOM.

## Fichiers à créer (et rien d'autre)

- `src/core/zwo.js`
- `test/zwo.test.js`

## Format produit

Chaque bloc a cette forme, quel que soit son type dans le fichier :

```js
{ source: 'Warmup', type: 'ramp', durationS: 600, powerStart: 0.25, powerEnd: 0.75 }
```

- `source` : nom de la balise d'origine.
- `type` : `'steady'` (puissance fixe), `'ramp'` (puissance qui varie) ou `'free'` (sans cible).
- `durationS` : durée en secondes.
- `powerStart`, `powerEnd` : fraction de la FTP (0.75 = 75 %), ou `null` pour `'free'`.

| Balise | Attributs lus | Bloc produit |
|---|---|---|
| `SteadyState` | `Duration`, `Power` (si absent : `PowerLow`) | `steady`, start = end = cette puissance |
| `Warmup`, `Cooldown`, `Ramp` | `Duration`, `PowerLow`, `PowerHigh` | `ramp`, start = `PowerLow`, end = `PowerHigh`, sans jamais les échanger |
| `FreeRide` | `Duration` | `free`, start = end = `null` |
| `IntervalsT` | `Repeat`, `OnDuration`, `OffDuration`, `OnPower`, `OffPower` | `Repeat` fois : un `steady` « on » puis un `steady` « off » |

Toute autre balise (par exemple `textevent`) est ignorée. Exporter toutes les fonctions listées ci-dessous, sauf `numberAttr`. Commenter en français. Aucune classe, aucun import.

## Fonctions, dans cet ordre

### `decodeEntities(text)` → chaîne
Remplace `&amp;` par `&`, `&lt;` par `<`, `&gt;` par `>`, `&quot;` par `"`, `&apos;` par `'`. Faire un seul passage avec cette expression, pour que `&amp;lt;` donne `&lt;` : `/&(amp|lt|gt|quot|apos);/g`.

### `parseAttributes(text)` → objet
Reçoit le texte des attributs d'une balise et retourne un objet nom → valeur (chaîne décodée par `decodeEntities`). Guillemets simples et doubles acceptés. Parcourir avec `text.matchAll` et cette expression (la valeur est dans le groupe 3 ou le groupe 4) :

```js
/([A-Za-z_][\w-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
```

### `tagText(xml, name)` → chaîne
Retourne le contenu de la première balise `name`, sans espaces autour, décodé par `decodeEntities`. Chaîne vide si elle n'existe pas. Expression à construire :

```js
new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`)
```

### `numberAttr(attrs, name, tag)` → nombre (non exportée)
Retourne `Number(attrs[name])`. Si l'attribut est absent, vide, ou si le résultat n'est pas un nombre fini : lancer `new Error(`.zwo invalide : ${tag} sans ${name} valide`)`.

### `parseZwo(xml)` → `{ name, description, blocks }`
1. Retirer les commentaires : `xml.replace(/<!--[\s\S]*?-->/g, '')`.
2. Trouver le contenu de la séance avec `/<workout\b[^>]*>([\s\S]*?)<\/workout>/`. Absent : lancer `new Error('.zwo invalide : balise <workout> absente')`. Le `\b` évite de confondre avec `<workout_file>`, car `_` compte comme une lettre.
3. Parcourir dans l'ordre du fichier, avec `matchAll`, les balises reconnues :

```js
/<(SteadyState|Warmup|Cooldown|Ramp|IntervalsT|FreeRide)\b([^>]*?)\/?>/g
```

4. Produire les blocs selon le tableau ci-dessus, avec `parseAttributes` et `numberAttr`.
5. Aucun bloc : lancer `new Error('.zwo invalide : aucun bloc')`.
6. `name` et `description` viennent de `tagText` (appliqué au texte sans commentaires).

### `totalDurationS(blocks)` → s
Somme des `durationS`.

## Tests à écrire dans `test/zwo.test.js`

Toutes les valeurs ci-dessous sont déjà calculées et vérifiées. Ne les recalcule pas : recopie-les, puis lance `npm test`.

Utiliser `node:test` et `node:assert/strict`. Copier ce fichier exemple dans une constante `SAMPLE` :

```xml
<?xml version="1.0"?>
<workout_file>
  <author>Test</author>
  <name>Séance &amp; test</name>
  <description>Six types de blocs</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.25" PowerHigh="0.75"/>
    <SteadyState Duration="300" Power="0.88" Cadence="90">
      <textevent timeoffset="10" message="Allez"/>
    </SteadyState>
    <!-- <SteadyState Duration="999" Power="9"/> -->
    <IntervalsT Repeat="2" OnDuration="30" OffDuration="60" OnPower="1.2" OffPower="0.5"/>
    <Ramp Duration="120" PowerLow="0.6" PowerHigh="1.0"/>
    <FreeRide Duration='180' FlatRoad="1"/>
    <Cooldown Duration="300" PowerLow="0.7" PowerHigh="0.3"/>
  </workout>
</workout_file>
```

**decodeEntities** : `'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;'` → `a & b <c> "d" 'e'` ; `'&amp;lt;'` → `&lt;`.

**parseAttributes** : `` ` Duration="600" FlatRoad='1' Name="a &amp; b"` `` → `{ Duration: '600', FlatRoad: '1', Name: 'a & b' }` (avec `assert.deepEqual`).

**tagText** : avec `SAMPLE`, `tagText(SAMPLE, 'name')` → `Séance & test` ; `tagText(SAMPLE, 'absent')` → chaîne vide.

**parseZwo(SAMPLE)** : `name` = `Séance & test`, `description` = `Six types de blocs`, `blocks.length` = 9, `totalDurationS(blocks)` = 1680. Vérifier toute la liste avec `assert.deepEqual` :

| i | source | type | durationS | powerStart | powerEnd |
|---|---|---|---|---|---|
| 0 | Warmup | ramp | 600 | 0.25 | 0.75 |
| 1 | SteadyState | steady | 300 | 0.88 | 0.88 |
| 2 | IntervalsT | steady | 30 | 1.2 | 1.2 |
| 3 | IntervalsT | steady | 60 | 0.5 | 0.5 |
| 4 | IntervalsT | steady | 30 | 1.2 | 1.2 |
| 5 | IntervalsT | steady | 60 | 0.5 | 0.5 |
| 6 | Ramp | ramp | 120 | 0.6 | 1 |
| 7 | FreeRide | free | 180 | null | null |
| 8 | Cooldown | ramp | 300 | 0.7 | 0.3 |

**SteadyState sans Power** : `parseZwo('<workout><SteadyState Duration="60" PowerLow="0.5" PowerHigh="0.5"/></workout>')` donne `name` vide, `description` vide, et un seul bloc `{ source: 'SteadyState', type: 'steady', durationS: 60, powerStart: 0.5, powerEnd: 0.5 }`.

**Erreurs** : avec `assert.throws(() => ..., { message: '...' })`

| Entrée | Message exact |
|---|---|
| `<workout_file></workout_file>` | `.zwo invalide : balise <workout> absente` |
| `<workout></workout>` | `.zwo invalide : aucun bloc` |
| `<workout><SteadyState Power="0.5"/></workout>` | `.zwo invalide : SteadyState sans Duration valide` |
| `<workout><Ramp Duration="60" PowerLow="x" PowerHigh="1"/></workout>` | `.zwo invalide : Ramp sans PowerLow valide` |

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : tous les tests passent, 0 échec.

## Ne pas faire

- Aucun autre fichier, et aucune modification des modules existants, de `package.json`, `AGENTS.md` ou `docs/`.
- Pas de `DOMParser`, de dépendance npm, d'accès aux fichiers ni de DOM dans `zwo.js`.
- Pas de calcul de la cible à un instant donné ni de pause : c'est l'étape 4.
- Pas d'import depuis l'interface : c'est l'étape 23.
- Ne jamais changer une valeur attendue pour faire passer un test. Si un test échoue après vérification du code, s'arrêter et le signaler.
