# Zwift Bis — règles de l'exécutant

## Le projet

Simulateur de vélo d'intérieur dans le navigateur, pour un seul utilisateur.
Il se connecte à un Zwift Hub One et à une ceinture cardio en Bluetooth, et fait rouler sur de vraies routes en 3D cartoon.
Il pilote aussi des séances ERG et exporte les sorties en fichier FIT.

## Stack

- HTML + JavaScript en modules ES, sans framework ni étape de build.
- Three.js et le SDK FIT Garmin chargés depuis un CDN (selon les étapes).
- Node.js pour les tests (`node:test`) et les outils de `tools/`.
- Web Bluetooth (Chrome ou Edge). Hébergement sur GitHub Pages.

## Règle de lecture

Ne lis jamais docs/cahier-des-charges.md. Travaille uniquement à partir du plan de l'étape en cours (plans/etape-XX.md) et, si nécessaire, de docs/architecture.md.

Ne lis pas `docs/roadmap.md` ni `docs/methode-architecte.md`, et ne charge que les fichiers utiles à l'étape : ton contexte est limité.

## Règles de travail

1. Ne fais que ce que le plan demande. Respecte sa section « Ne pas faire ».
2. Écris une fonction à la fois, dans l'ordre du plan, puis passe à la suivante.
3. Explique chaque choix à l'utilisateur, en français et en termes simples : ce projet sert à apprendre.
4. Garde des petits fichiers, avec une seule responsabilité par fichier.
5. Commente le code en français, surtout les formules et leurs unités.
6. N'ajoute aucune dépendance sans l'accord de l'utilisateur.
7. N'exécute aucune commande destructive sans son accord (`rm`, `git reset`, `git push --force`, écrasement de fichier).
8. Ne fais ni `git commit` ni `git push` sans demande explicite.
9. Si le plan est ambigu ou semble faux, arrête-toi et pose la question. N'invente pas.
10. Ne modifie jamais une valeur attendue dans un test pour le faire passer.
11. Termine toujours en disant à l'utilisateur comment tester l'étape, avec les commandes et le résultat attendu.

## Lancer les tests

```bash
npm test
```

## Lancer l'app en local

Disponible à partir de l'étape 9, une fois `tools/serve.mjs` écrit :

```bash
npm start
```

Puis ouvrir `http://localhost:8000` dans Chrome. Web Bluetooth fonctionne sur `localhost` et en HTTPS.
