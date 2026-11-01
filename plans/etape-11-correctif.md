# Étape 11 — Correctif : résistance sur 2 octets

## Objectif

Corriger la puissance affichée avec le vrai Hub. Le champ résistance y fait 2 octets, et la page en lit 1 : la puissance lue est décalée d'un octet, donc 256 fois trop grande (27 W affichés 6912 W).

Trame réelle relevée sur le Hub : `64 02 00 00 00 00 14 00 00 00 00`.

| Octets | Champ |
|---|---|
| `64 02` | flags : vitesse, cadence, résistance, puissance, fréquence cardiaque |
| `00 00` | vitesse |
| `00 00` | cadence |
| `14 00` | résistance sur 2 octets |
| `00 00` | puissance |
| `00` | fréquence cardiaque |

## Fichiers à modifier (et rien d'autre)

- `index.html`
- `src/devices/ftms.js` (un commentaire)
- `src/core/ftms-codec.js` (un commentaire)
- `test/ftms.test.js` (ajouter un test à la fin)

**Important : ne lance jamais `npm start` ni `node tools/serve.mjs`.**

## `index.html`

Remplacer exactement la ligne :

```js
    const hub = createFtmsTrainer({ bluetooth: navigator.bluetooth });
```

par :

```js
    // Le vrai Hub envoie la résistance sur 2 octets (vérifié sur une trame réelle).
    const hub = createFtmsTrainer({ bluetooth: navigator.bluetooth, resistanceBytes: 2 });
```

## Commentaires

Dans `src/devices/ftms.js`, remplacer les lignes :

```js
 * `resistanceBytes` : taille du champ résistance dans les trames (1 ou 2
 * octets). Les documents se contredisent ; la valeur sera tranchée avec
 * le vrai matériel à cette étape.
```

par :

```js
 * `resistanceBytes` : taille du champ résistance dans les trames (1 ou 2
 * octets). Le vrai Hub en envoie 2 : index.html passe cette valeur.
```

Dans `src/core/ftms-codec.js`, remplacer les lignes :

```js
 * `resistanceBytes` : taille du champ résistance (1 ou 2 octets).
 * Les documents se contredisent ; la bonne valeur sera tranchée à l'étape 11.
```

par :

```js
 * `resistanceBytes` : taille du champ résistance (1 ou 2 octets).
 * Le vrai Hub en envoie 2 : c'est l'appelant qui choisit cette valeur.
```

## Test

Ajouter à la fin de `test/ftms.test.js`, sans toucher au reste du fichier :

```js
// --- Trames du vrai Hub ---

test('vrai Hub : résistance sur 2 octets, puissance lue sans décalage', async () => {
  const bluetooth = fakeBluetooth();
  const trainer = createFtmsTrainer({ bluetooth, resistanceBytes: 2 });
  const data = [];
  trainer.onData((d) => data.push(d));
  await trainer.connect();
  const c = bluetooth.devices[0].ch;
  c.send([0x64, 2, 0, 0, 0, 0, 0x14, 0, 0, 0, 0]); // trame réelle, à l'arrêt
  c.send([0x64, 2, 0, 0, 0, 0, 0x14, 0, 0x1B, 0, 0]); // même trame avec 27 W
  assert.deepEqual(data, [{ powerW: 0, cadenceRpm: 0 }, { powerW: 27, cadenceRpm: 0 }]);
});
```

## Vérification par l'utilisateur

```bash
npm test
```

Résultat attendu : 143 tests, 0 échec.

Sur la page publiée, connecter le Hub et pédaler à la main : la puissance affichée doit être de quelques dizaines de watts.

## Ne pas faire

- Ne pas changer la valeur par défaut `resistanceBytes = 1` : des tests existants en dépendent.
- Aucun autre fichier, aucune autre ligne de code.
- Ne jamais changer une valeur attendue d'un test existant.
- Pas de commit ni de push.
