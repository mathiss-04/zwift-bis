# Feuille de route — V1

Chaque étape : une session de l'exécutant, 1 à 3 fichiers (tests compris), 300 lignes environ. Le plan détaillé de l'étape N+1 n'est rédigé qu'après relecture de l'étape N. Découpage et ordre peuvent donc évoluer.

« Tests » = `npm test` passe, avec des valeurs chiffrées fixées dans le plan.

## A. Logique pure (Node seul, aucun matériel)

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 1 | Physique | `package.json`, `core/physics.js`, test | Tests : 200 W à plat → 33,9 km/h |
| 2 | Statistiques et zones | `core/stats.js`, `core/zones.js`, test | Tests : puissance normalisée d'une série connue, limites des zones |
| 3 | Lecture .zwo | `core/zwo.js`, test | Tests : les 6 types de blocs d'un fichier exemple sont lus |
| 4 | Déroulé de séance | `core/workout.js`, test | Tests : cible à un instant t, rampes, ±5 %, pause |
| 5 | Parcours en mémoire | `core/route.js`, test | Tests sur une mini-boucle : interpolation, passage de tour |
| 6 | État de sortie | `core/ride.js`, test | Tests : distance après 60 s sur une boucle connue |
| 7 | Commande de résistance | `core/resistance.js`, test | Tests : difficulté, bornes ±16 %, ERG, FreeRide |
| 8 | Décodage Bluetooth | `core/ftms-codec.js`, `core/hr-codec.js`, test | Tests : trames en octets ↔ valeurs attendues |

## B. Navigateur, sans matériel

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 9 | Page et simulateur | `tools/serve.mjs`, `index.html`, `devices/simulator.js` | `npm start` : le curseur de puissance affiche sa valeur sur le Mac |
| 10 | Boucle et HUD minimal | `app.js`, `ui/hud.js` | Sur une route plate fictive, à 200 W, la vitesse monte vers 33,9 km/h sans saut |

## C. Bluetooth réel (PC Windows, Zwift Hub One)

Avant l'étape 11 : création du dépôt et publication sur GitHub Pages, uniquement avec l'accord explicite de l'utilisateur.

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 11 | Connexion et lecture | `devices/ftms.js`, `ui/pairing.js` | Puissance et cadence réelles affichées, trames brutes visibles, message clair si Zwift occupe le Hub |
| 12 | Pente | `devices/ftms.js` | Résistance ressentie nettement différente à 0 %, 5 % et 10 %, réponses `0x01` |
| 13 | ERG | `devices/ftms.js` | Cible 150 W puis 200 W : la puissance mesurée se stabilise à ±10 W |
| 14 | Ceinture cardio | `devices/heartrate.js`, `ui/pairing.js` | FC affichée ; l'app fonctionne sans ceinture |
| 15 | Reconnexion | `devices/ftms.js`, `app.js` | Hub éteint 30 s en pleine sortie : reprise seule, avec la dernière consigne et sans perte de données |

## D. Préparation des parcours (Mac)

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 16 | GPX et rééchantillonnage | `tools/lib/gpx.mjs`, test | Tests : longueur et pas d'une boucle fictive |
| 17 | Lissage et pentes | `tools/lib/profile.mjs`, test | Tests : pic artificiel de 25 % éliminé, boucle sans saut à la jonction |
| 18 | Altitudes IGN et `route.json` | `tools/lib/ign.mjs`, `tools/prepare-route.mjs` | La vraie boucle est produite ; D+ cohérent avec Komoot/Strava ; `--start-km` opérationnel |
| 19 | Carte de relief | `tools/lib/heightmap.mjs`, `tools/prepare-route.mjs` | `heightmap.bin` fait exactement 4 × cols × rows octets ; route et grille concordent |
| 20 | Parcours dans l'app | `app.js`, `ui/profile-chart.js` | Avec le simulateur : profil affiché, position et pente correctes, tours enchaînés |

## E. Fonctions de la sortie

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 21 | Profil cycliste | `ui/store.js`, `ui/profile-form.js` | Valeurs conservées après rechargement ; CdA estimé depuis la taille |
| 22 | HUD complet | `ui/hud.js`, CSS | Tous les champs du §4.7, lisibles à 1,5 m, couleurs de zones |
| 23 | Séance : déroulé | `app.js`, `ui/workout-view.js` | Import d'un .zwo, bloc courant, cible, temps restant |
| 24 | Séance : commandes | `ui/workout-view.js`, `app.js` | Graphique et position, ±5 %, pause/reprise, testés sur le Hub |
| 25 | Enregistrement | `core/recorder.js`, `ui/store.js`, test | Onglet fermé en pleine sortie : sortie récupérée, moins de 10 s perdues |
| 26 | Export FIT | `core/fit-export.js`, test | Import réel accepté par Strava : distance, durée et puissance correctes |
| 27 | Historique | `ui/history.js`, `ui/store.js` | Liste avec résumés, re-téléchargement du FIT |

## F. Graphismes 3D

| N° | Étape | Fichiers | Critère de réussite |
|---|---|---|---|
| 28 | Scène et terrain | `scene/scene.js`, `scene/terrain.js` | Relief reconnaissable, 60 images/s sur le PC |
| 29 | Route | `scene/road.js` | Ruban continu sur toute la boucle, sans passer sous le terrain |
| 30 | Avatar et caméra | `scene/avatar.js`, `scene/scene.js` | Pédalage synchronisé avec la cadence, caméra qui suit sans à-coups |
| 31 | Arbres, ciel, lumière | `scene/trees.js`, `scene/scene.js` | Ambiance cartoon, toujours 60 images/s |
| 32 | Recette V1 | corrections seulement | Sortie libre et séance ERG complètes sur la vraie boucle, export accepté par Strava |

Les chemins `core/`, `devices/`, `ui/` et `scene/` sont dans `src/`. Les tests sont dans `test/`.
