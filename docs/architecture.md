# Architecture — Zwift Bis

Application web statique (HTML + modules ES), sans build ni serveur. La logique métier ne connaît ni l'écran ni le Bluetooth : elle se teste seule sous Node.

## Arborescence

```
index.html          page unique
package.json        scripts npm (aucune dépendance en production)
AGENTS.md           règles de l'exécutant
src/
  core/             logique pure, testée sous Node (ni DOM, ni Bluetooth)
  devices/          home-trainer, simulateur, cardio
  scene/            3D Three.js
  ui/               écrans et HUD
  app.js            chef d'orchestre : relie les modules, porte la boucle
routes/<id>/        parcours préparés (route.json + heightmap.bin), publiés
data/raw/           GPX et fichiers bruts, hors de git
tools/              outils Mac : prepare-route.mjs, serve.mjs, tools/lib/
assets/             modèles 3D CC0
test/               tests node:test
docs/  plans/       documentation et plans d'étape
```

## Modules

| Module | Responsabilité |
|---|---|
| `core/physics.js` | Forces et vitesse à partir de la puissance et de la pente |
| `core/route.js` | Position et pente à une distance donnée, tours de boucle |
| `core/ride.js` | État de la sortie : combine physique et parcours à chaque pas de temps |
| `core/resistance.js` | Commande à envoyer au trainer : pente × difficulté, ou ERG |
| `core/zwo.js` | Lecture d'un .zwo vers une liste de blocs (analyseur maison, testable sans DOM) |
| `core/workout.js` | Déroulé de la séance : bloc courant, cible, ±5 %, pause |
| `core/stats.js`, `core/zones.js` | Moyenne 3 s, puissance normalisée, D+ ; zones FTP |
| `core/recorder.js` | Échantillons à 1 Hz |
| `core/fit-export.js` | Sortie vers messages FIT, encodeur Garmin injecté en paramètre |
| `core/ftms-codec.js`, `core/hr-codec.js` | Octets ↔ valeurs, sans Bluetooth |
| `devices/ftms.js`, `devices/heartrate.js` | Web Bluetooth : connexion, file de commandes, reconnexion |
| `devices/simulator.js` | Faux trainer, même interface que `ftms.js` |
| `ui/store.js` | Profil, sorties et sauvegardes (IndexedDB) |
| `scene/*.js` | `scene`, `terrain`, `road`, `avatar`, `trees` |
| `tools/prepare-route.mjs` | GPX → parcours publié |

Interface commune des trainers : `connect()`, `disconnect()`, `onData(cb)` avec `{ powerW, cadenceRpm }`, `setGrade(pourcent)`, `setTargetPower(watts)`.

## Flux de données

```
Trainer (ou simulateur) ──1 Hz──> puissance, cadence ─┐
Cardio (optionnelle) ───────────> FC ─────────────────┤
                                                      v
                  boucle 20 Hz (setInterval) : ride.js + physics.js + route.js
                  vitesse, distance, position, pente
                   │          │             │              │
       resistance.js      HUD (4 Hz)   scène 3D (rAF)   recorder.js (1 Hz)
                   │                                       │
  setGrade / setTargetPower (1 Hz)             IndexedDB (toutes les 10 s)
```

- La physique tourne hors de `requestAnimationFrame` pour continuer si l'affichage ralentit. Sans donnée depuis 3 s, la puissance vaut 0.
- Difficulté : pente envoyée = pente réelle × difficulté, bornée à ±16 %. La physique utilise toujours la pente réelle.
- Bloc FreeRide : le trainer quitte l'ERG et suit la pente avec la difficulté, puis l'ERG reprend au bloc suivant.

## Protocole Bluetooth (vérifié)

- **FTMS** `0x1826` : Indoor Bike Data `0x2AD2` (notify), Control Point `0x2AD9` (write + indicate), Status `0x2ADA`, Feature `0x2ACC`.
- **Séquence** : activer les indications, `0x00` Request Control, `0x07` Start, puis les commandes. À refaire après chaque reconnexion, avec la dernière consigne.
- **Commandes** (petit-boutiste) : `0x05` Target Power = sint16, 1 W. `0x11` Simulation = vent sint16 (0,001 m/s), pente sint16 (0,01 %), Crr uint8 (0,0001), Cw uint8 (0,01 kg/m). `0x08` Stop/Pause = `0x01` stop, `0x02` pause.
- **Réponse** : `0x80`, opcode demandé, résultat (`0x01` succès, `0x02` non supporté, `0x03` paramètre invalide, `0x04` échec, `0x05` non permis). Une seule écriture à la fois : file d'attente où la dernière consigne remplace les précédentes.
- **Indoor Bike Data** : flags uint16, puis dans l'ordre : bit 0 **inversé** (à 0 : vitesse uint16, 0,01 km/h), bit 1 vitesse moyenne, bit 2 cadence uint16 (0,5 tr/min), bit 3 cadence moyenne, bit 4 distance uint24, bit 5 résistance, bit 6 puissance sint16 (1 W), bit 7 puissance moyenne, bit 8 énergie (5 octets), bit 9 FC, bit 10 MET, bit 11 et 12 temps. Une mesure peut arriver en plusieurs notifications : on ne met à jour que les champs présents.
- **Cardio** `0x180D`, mesure `0x2A37` : flags uint8 ; bit 0 à 0 → FC uint8, à 1 → uint16 ; bit 3 énergie ; bit 4 intervalles RR.

**Points ouverts, à trancher sur le vrai Hub :**
1. Taille du champ Resistance Level : uint8 d'après le schéma Bluetooth SIG, 2 octets dans Auuki. Si le bit 5 est actif, cela décale la puissance. L'étape FTMS affiche donc les trames brutes.
2. Je n'ai trouvé aucune source sur le comportement du Hub One en simulation de pente pilotée par une app tierce (l'ERG est confirmé). D'où un test réel dès les étapes 10-11, avant la 3D.
3. Le Hub mesure peut-être la puissance après la chaîne. Dans ce cas, le rendement η compterait les pertes deux fois. Valeur à revoir une fois sur le matériel.

## Parcours préparé

`routes/<id>/route.json` : colonnes de même longueur, points à pas constant (distance du point i = i × `stepM`, donc recherche directe sans parcours du tableau).

```json
{
  "version": 1, "id": "boucle-01", "name": "Ma boucle", "isLoop": true,
  "attribution": "Altitudes : IGN – RGE ALTI, Licence Ouverte 2.0",
  "origin": { "lat": 45.0, "lon": 5.0 },
  "lengthM": 35000.0, "stepM": 10.0, "ascentM": 420.0,
  "lat": [], "lon": [],
  "x": [], "z": [], "alt": [], "grade": [],
  "heightmap": {
    "file": "heightmap.bin", "cols": 513, "rows": 513,
    "minX": -8000, "maxX": 8000, "minZ": -8000, "maxZ": 8000,
    "minAlt": 200.0, "maxAlt": 650.0
  }
}
```

- **Unités** : `x`, `z`, `alt` en mètres ; `grade` en fraction (0,05 = 5 %). `x` = est, `z` = −nord, `y` = altitude dans Three.js. Le dernier point rejoint le premier.
- **Projection** : équirectangulaire locale, `x = R·cos(lat0)·Δlon`, `z = −R·Δlat`, avec R = 6 371 000 m.
- **`heightmap.bin`** : `cols × rows` flottants 32 bits petit-boutistes, ligne 0 au nord, lisibles directement avec `new Float32Array(buffer)`. Environ 1 Mo. Les cellules proches de la route sont aplanies par le script.
- **Préparation** : rééchantillonnage à environ 10 m, altitudes RGE ALTI, filtre médian puis moyenne glissante (le MNT donne le sol, donc des creux aux ponts), pente centrée sur 100 m. Les réglages exacts seront fixés dans le plan de l'étape.
- **Vie privée** : `--start-km` décale le départ loin du domicile, et les GPX restent hors de git. La zone générale de la boucle reste publique.

## Choix techniques

| Choix | Raison |
|---|---|
| Modules ES sans build | Le code qui tourne est celui qu'on lit, ce qui aide à apprendre. |
| `node:test` | Inclus dans Node, donc aucune dépendance pour les tests. |
| Accélération par forces, vitesse plancher de 1 m/s dans P/v | Évite la division par zéro au démarrage et permet de partir en roue libre dans une descente. |
| Three.js via CDN avec version figée | Exigé par le cahier des charges ; la version figée évite les surprises. |
| SDK FIT Garmin via CDN, chargé à l'export | L'encodeur officiel limite le risque de rejet ; sa licence restreint la redistribution, donc aucune copie dans le dépôt. |
| `session.sport = cycling`, `sub_sport = virtual_activity` (58) | Strava déduit le type d'activité de ces champs. La reconnaissance en « Virtual Ride » reste à confirmer par un import réel. |
| Altitudes : API `elevation.json`, ressource `ign_rge_alti_wld` | Sans clé (testé), 5 000 points par requête, 5 requêtes/s. |
| Relief : WMS `ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`, format `image/x-bil;bits=32` | Grille brute de flottants (testée en 513 × 513), sans lecteur TIFF à écrire. |
| Licence Ouverte 2.0 | Réutilisation gratuite avec mention de la source, affichée dans l'app. |
| Dépôt public, GitHub Pages | Gratuit en HTTPS, ce qu'exige Web Bluetooth. |
| Auuki comme simple référence | Il est sous AGPL-3.0 : on s'en inspire pour comprendre, on ne copie pas son code. |
| Rampes .zwo de `PowerLow` vers `PowerHigh` | D'après la référence communautaire (Zwift ne publie pas de spécification). Le sens des Cooldown sera vérifié sur de vrais fichiers. |

## Sources

- FTMS : [spécification 1.0](https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/), [schéma Indoor Bike Data](https://bitbucket.org/bluetooth-SIG/public/raw/main/gss/org.bluetooth.characteristic.indoor_bike_data.yaml), UUID [services](https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/uuids/service_uuids.yaml) et [caractéristiques](https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/uuids/characteristic_uuids.yaml)
- Cardio : [schéma Heart Rate Measurement](https://bitbucket.org/bluetooth-SIG/public/raw/main/gss/org.bluetooth.characteristic.heart_rate_measurement.yaml)
- IGN : [calcul altimétrique](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-altimetrique/), [ressources](https://data.geopf.fr/altimetrie/resources), [WMS raster](https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities), [licence (data.gouv.fr)](https://www.data.gouv.fr/datasets/referentiel-a-grande-echelle-rge/)
- .zwo : [référence communautaire](https://github.com/h4l/zwift-workout-file-reference/blob/master/zwift_workout_file_tag_reference.md)
- FIT : [SDK JavaScript Garmin](https://github.com/garmin/fit-javascript-sdk), [fichiers Activity](https://developer.garmin.com/fit/articles/file-types/activity.html), [import Strava](https://developers.strava.com/docs/uploads)
- GitHub Pages : [plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [limites](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- Référence Bluetooth : [Auuki](https://github.com/dvmarinoff/Auuki)
