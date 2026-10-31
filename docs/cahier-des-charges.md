# Cahier des charges — Zwift Bis

Simulateur de vélo d'intérieur simplifié, inspiré de Zwift, pour rouler sur mes propres routes autour de chez moi. Projet personnel et d'apprentissage.

---

## 0. Méthode de travail

- **Claude Code** (architecte) : lit ce cahier des charges, conçoit l'architecture, rédige un plan détaillé **pour une seule étape à la fois** dans `plans/`, puis relit le code produit avant de rédiger le plan suivant.
- **Pi + Qwen 3.8 27B en local** (exécutant) : implémente le plan de l'étape en cours, une fonction à la fois. Contexte limité à ~32k tokens : il ne doit **jamais** lire ce cahier des charges, uniquement `AGENTS.md` et le plan de l'étape en cours.
- **Moi** : je teste chaque étape sur le vrai matériel avant de passer à la suivante.
- Les plans doivent être précis : fichiers à créer, fonctions (entrées/sorties), formules, et critères de test chiffrés.

---

## 1. Objectif

Une application web qui :
1. se connecte à mon home-trainer et à une ceinture cardio en Bluetooth ;
2. me fait rouler sur des parcours réels autour de chez moi, en 3D cartoon, avec une simulation de pente fidèle ;
3. pilote des entraînements structurés en mode ERG ;
4. enregistre mes sorties et les exporte vers Strava.

---

## 2. Environnement d'utilisation

- **1 seul utilisateur** (moi).
- **Machine de roulage** : PC Windows, navigateur **Chrome ou Edge** (Web Bluetooth requis), Bluetooth intégré ou clé USB.
- **Machine de développement** : Mac.
- **Hébergement** : **GitHub Pages** (HTTPS obligatoire pour Web Bluetooth). Publication par `git push` depuis le Mac.
- Pas de serveur back-end en V1 : tout tourne dans le navigateur.

---

## 3. Matériel

### Home-trainer : Zwift Hub One
- Protocole : **Bluetooth FTMS** (Fitness Machine Service).
- Lecture : puissance et cadence (caractéristique *Indoor Bike Data*).
- Contrôle (caractéristique *Control Point*) :
  - mode ERG : *Set Target Power* ;
  - simulation de pente : *Set Indoor Bike Simulation Parameters*.
- Pente maximale simulée : 16 %.
- **Un seul pignon** (vitesses virtuelles via Zwift Click, système propriétaire non supporté). Conséquence : en sortie libre, un réglage de **difficulté de pente** est indispensable (voir 4.3).
- **Une seule connexion Bluetooth à la fois** : afficher un message clair si la connexion échoue (« fermez Zwift / Zwift Companion »).
- Calibration : faite dans l'app Zwift pour l'instant (hors périmètre V1).

### Ceinture cardio (optionnelle)
- Bluetooth standard *Heart Rate Service*.
- L'app doit fonctionner normalement sans ceinture.

### Robustesse
- Reconnexion automatique en cas de perte du signal, sans interrompre ni perdre la sortie.

### Référence
- Le projet open source **Auuki** (Web Bluetooth, FTMS, ERG, fichiers .zwo) peut servir de référence pour la couche Bluetooth.

---

## 4. Fonctionnalités V1

### 4.1 Profil
- Poids du cycliste, poids du vélo, FTP, taille (pour estimer la surface frontale).
- Stocké localement.

### 4.2 Connexion des appareils
- Écran d'appairage : home-trainer (obligatoire), cardio (optionnel).
- Affichage en direct de la puissance, de la cadence et de la FC pour vérifier que tout fonctionne.

### 4.3 Sortie libre sur parcours
- Choix d'un parcours parmi ceux disponibles (1 parcours en V1).
- La pente du parcours est envoyée en continu au home-trainer.
- **Réglage de difficulté** de 0 à 100 % (défaut 50 %) : pourcentage de la pente réelle transmis au trainer. Ne s'applique qu'à la résistance, **pas** à la physique de la vitesse.
- Parcours en boucle : enchaîner les tours.

### 4.4 Entraînements structurés (mode ERG)
- **Import de fichiers .zwo** (format XML Zwift) : blocs *Warmup*, *Cooldown*, *SteadyState*, *Ramp*, *IntervalsT*, *FreeRide*. Puissances exprimées en % de FTP.
- L'entraînement se déroule **sur un parcours** : l'avatar avance selon la physique, mais le trainer est piloté en ERG (la pente n'influence plus la résistance).
- Affichage : bloc en cours, puissance cible, temps restant dans le bloc, graphique de la séance avec la position actuelle.
- Ajustement de l'intensité en cours de séance (± 5 % par appui).
- Pause et reprise.

### 4.5 Physique
- Modèle physique standard du cyclisme :
  - résistance au roulement ;
  - gravité (pente) ;
  - traînée aérodynamique ;
  - inertie (accélérations et décélérations progressives, pas de vitesse qui « saute ») ;
  - rendement de transmission.
- Paramètres par défaut raisonnables (Crr, CdA, densité de l'air, rendement), modifiables dans le code.
- En descente, la vitesse doit atteindre une vitesse limite réaliste.
- **Tests unitaires obligatoires** sur le module physique, avec des valeurs de référence chiffrées (plat, montée, descente) calculées et documentées par Claude Code.

### 4.6 Préparation des parcours (outil hors ligne, sur le Mac)
- Un script prend un fichier **GPX** (itinéraire Komoot ou Strava, boucle de 30-40 km) et produit les données du parcours :
  - points du tracé, distance cumulée ;
  - altitude **recalée sur un modèle de relief** (données IGN de préférence, à vérifier par Claude Code) ;
  - **profil lissé** : aucune pente aberrante (ex. +25 % sur quelques mètres) ;
  - pente calculée sur une distance glissante ;
  - carte de relief (heightmap) de la zone pour le terrain 3D.
- Les données générées sont enregistrées dans le projet : aucun appel à une API pendant que je roule.

### 4.7 Affichage pendant la sortie (HUD)
- Puissance (instantanée et moyenne 3 s), cadence, FC, vitesse, distance, temps, dénivelé positif, pente actuelle.
- Profil d'altitude du parcours avec ma position.
- Couleur de la puissance selon les zones (basées sur la FTP).
- Lisible à 1,5 m de l'écran.

### 4.8 Graphismes 3D (cartoon)
- **Three.js**.
- Style **low-poly cartoon**, couleurs vives, ambiance proche de Zwift (sans copier ses ressources).
- Terrain généré à partir de la carte de relief.
- Route en ruban qui suit le tracé GPX et le relief.
- Ciel, lumière douce, arbres placés automatiquement le long de la route.
- **Avatar simple** : cycliste low-poly dont le pédalage est synchronisé avec la cadence.
- Caméra à la troisième personne qui suit l'avatar.
- Objectif : 60 images/s sur un PC de milieu de gamme.
- Ressources 3D libres de droits uniquement (CC0, ex. Kenney, Quaternius).

### 4.9 Enregistrement et export
- Enregistrement des données à 1 Hz : position sur le parcours (lat/lon/altitude), puissance, cadence, FC, vitesse, distance.
- **Sauvegarde régulière** pendant la sortie : en cas de plantage ou de fermeture accidentelle, la sortie est récupérable.
- **Export en fichier FIT** (activité vélo virtuelle), importable manuellement sur Strava.

### 4.10 Historique
- Liste des sorties avec résumé : date, durée, distance, D+, puissance moyenne et normalisée, FC moyenne.
- Re-téléchargement du fichier FIT de chaque sortie.
- Stockage local dans le navigateur (IndexedDB).

---

## 5. Versions suivantes

### V2
- Plusieurs parcours.
- Décor généré depuis **OpenStreetMap** : forêts, champs, maisons, rivières.
- **Météo dynamique, purement visuelle** : ciel changeant, pluie, brouillard, route mouillée.
- Avatars personnalisables.
- Vitesses virtuelles au clavier (compensation du pignon unique) : à étudier.

### V3
- Envoi automatique vers Strava (API Strava + authentification OAuth).
- Test FTP guidé.

---

## 6. Contraintes techniques

- App web statique : **HTML + JavaScript (modules ES)**, sans framework ni étape de build.
- Bibliothèques chargées depuis un CDN (Three.js, et éventuellement un encodeur FIT). Toute nouvelle dépendance doit être justifiée et validée par moi.
- Scripts de préparation des parcours : Node.js (disponible sur le Mac).
- Petits fichiers, une responsabilité par fichier (ex. `physics.js`, `ftms.js`, `heartrate.js`, `workout.js`, `scene.js`, `recorder.js`, `fit-export.js`).
- La logique métier (physique, parsing .zwo, lissage, export FIT) doit être **indépendante** de l'affichage et du Bluetooth, pour être testable seule.
- Un **simulateur de home-trainer** (puissance et cadence simulées au clavier ou par curseur) pour pouvoir développer et tester sur le Mac sans le matériel.
- Code lisible et commenté : c'est un projet d'apprentissage, je dois comprendre ce que fait chaque fichier.

---

## 7. Hors périmètre

- Multijoueur.
- ANT+.
- Safari, iPhone, iPad (pas de Web Bluetooth).
- Zwift Click et vitesses virtuelles Zwift.
- Graphismes photoréalistes.
- Comptes utilisateurs en ligne, serveur back-end.
- Calibration du home-trainer (faite dans l'app Zwift).
