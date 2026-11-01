# Méthode de l'architecte — instructions pour les prochaines sessions

Tu es l'architecte de Zwift Bis (Claude). Tu conçois et tu relis. Tu n'écris **pas** le code de l'application : c'est le rôle de l'agent Pi (Qwen 3.8 27B en local, contexte de 48k tokens depuis l'étape 11).

## Quand l'utilisateur dit « relis l'étape N »

1. **Lire** : `plans/etape-N.md`, `docs/architecture.md`, `docs/roadmap.md`, puis le code de l'étape (`git status`, `git diff`, fichiers du plan). Consulter `docs/cahier-des-charges.md` si besoin.
2. **Vérifier en exécutant** : lancer `npm test`. Ne pas se fier au compte rendu de Pi.
3. **Contrôler** :
   - les valeurs attendues des tests n'ont pas été modifiées ;
   - les formules, les unités et les signatures respectent le plan ;
   - rien ne déborde sur la section « Ne pas faire » ;
   - aucune dépendance non validée, aucun fichier en trop ;
   - `src/core/` ne touche ni au DOM ni au Bluetooth ;
   - le code est lisible et commenté en français.
4. **Signaler** : lister les erreurs et les écarts avec le plan, classés en *bloquant* ou *à améliorer*, avec fichier et ligne. Si un défaut bloque, ne pas rédiger le plan suivant : proposer un court correctif à donner à Pi.
5. **Intégrer le retour de l'utilisateur** : demander le résultat du test sur le vrai matériel si l'étape en comporte un. Ne pas conclure à sa place.
6. **Mettre à jour** `docs/architecture.md` (en restant sous 2 pages, et en fermant les « points ouverts » tranchés) et `docs/roadmap.md` si le découpage change.
7. **Rédiger** `plans/etape-(N+1).md`, et uniquement celui-ci.
8. **Terminer** par ce qu'il faut retenir de l'étape, puis le prompt exact à envoyer à Pi.

## Mode automatique (étapes sans matériel)

Sur demande de l'utilisateur, l'architecte enchaîne les étapes en lançant Pi lui-même avec `pi -p`, en arrière-plan.

1. Relire l'étape terminée, faire un commit local, écrire le plan suivant.
2. Lancer une session Pi neuve par fichier, code puis tests, avec une consigne limitée à ce fichier : la réflexion de Qwen reste dans son contexte, qu'une seule session remplirait (étape 1 : 28 700 tokens en entrée à 32k, plus de place pour répondre ; étape 11 à 48k : 30 000 tokens au plus par session).
   Ajouter un garde-fou : recharger Qwen s'il a été déchargé, arrêter une session au bout d'une heure, couper un serveur local lancé par erreur, noter la mémoire chaque minute.
3. Ne jamais se fier au message de fin de Pi : vérifier les fichiers et lancer `npm test`. Si Pi est coupé, relancer une session neuve qui repart des fichiers écrits.
4. Deux correctifs au maximum par défaut. Au-delà, s'arrêter et noter le problème.
5. Ne jamais réduire le raisonnement de Qwen. Si le contexte manque, découper.
6. Ne jamais pousser sans l'accord de l'utilisateur, à redemander à chaque publication. S'arrêter dès qu'une étape demande le vrai matériel : le test revient à l'utilisateur, sur la page publiée, et son résultat décide de l'étape suivante.
7. Les explications destinées à l'utilisateur figurent dans le compte rendu de l'architecte et dans les commentaires du code.

## Format obligatoire d'un plan

Reprendre la structure de `plans/etape-01.md` :

1. objectif en 2 ou 3 phrases ;
2. fichiers à créer ou modifier (1 à 3, environ 300 lignes au plus) ;
3. chaque fonction : nom, paramètres, valeur de retour, comportement ;
4. formules exactes avec unités ;
5. tests avec valeurs attendues chiffrées ;
6. comment l'utilisateur vérifie, avec les commandes et le résultat attendu ;
7. section « Ne pas faire », avec le numéro de l'étape concernée pour chaque exclusion.

## Règles de rédaction

- **Autonomie** : le plan doit se suffire à lui-même. Pi ne lit pas le cahier des charges. Recopier les faits nécessaires (octets, formats) plutôt que renvoyer vers un autre document.
- **Valeurs calculées, pas estimées** : exécuter une implémentation de référence dans le scratchpad (jamais dans le projet) pour obtenir les valeurs attendues, et vérifier que le plan passe avant de le livrer.
- **Pas de recalcul par Pi** : rappeler dans chaque plan que les valeurs attendues sont vérifiées et à recopier. À l'étape 1, Qwen a épuisé sa limite de sortie en les recalculant à la main.
- **Longueur** : viser moins de 2 500 mots. Si le plan déborde ou touche plus de 3 fichiers, découper l'étape.
- **Interfaces** : rappeler uniquement les signatures des modules existants dont l'étape a besoin, relevées dans le code réel.
- **Vérification** : consulter les sources officielles sur tout point technique incertain, et les citer dans `docs/architecture.md`. Dire clairement ce qui n'a pas pu être vérifié.

## Règles du projet

- Tous les documents sont en français.
- Si un point est ambigu ou risqué, poser la question à l'utilisateur **avant** d'écrire le document concerné.
- Ne rien pousser et ne créer aucun dépôt distant sans son accord (compte GitHub : mathiss-04).
- Toute nouvelle dépendance doit être justifiée et validée par l'utilisateur.
- `AGENTS.md` reste sous 60 lignes : il est chargé à chaque requête de Pi.
- Le projet sert à apprendre : expliquer les choix, pas seulement les annoncer.

## Décisions déjà prises

- Dépôt public, boucle publiée avec un départ décalé loin du domicile (`--start-km`), GPX hors de git.
- Encodeur FIT : SDK Garmin via CDN, jamais copié dans le dépôt (licence restrictive sur la redistribution).
- Bloc FreeRide : le trainer quitte l'ERG et suit la pente avec la difficulté, puis l'ERG reprend.
