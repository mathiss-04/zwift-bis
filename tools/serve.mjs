// Serveur local de développement pour Zwift Bis.
//
// Modules Node uniquement (aucune dépendance). Il sert les fichiers du projet
// au navigateur : `npm start`, puis ouvrir http://localhost:8000.
// Le port est réservé à 127.0.0.1 : seul ce Mac peut y accéder.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Port utilisé par défaut pour le développement.
export const DEFAULT_PORT = 8000;

// Types de contenu (Content-Type) par extension de fichier, en minuscules.
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.zwo': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
};

// Type de contenu d'un fichier, d'après son extension (insensible à la casse).
// Extension inconnue ou absente → flux binaire par défaut.
export function contentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

// Transforme un chemin d'URL (ex. /src/app.js?v=1) en chemin de fichier sur
// disque, à l'intérieur de `rootDir`. Retourne `null` si le chemin est
// invalide ou essaie de sortir du projet :
//   1. on garde ce qui précède le premier « ? » ou « # »,
//   2. on décode les échappements %-xx (séquence mal formée → null),
//   3. octet null → null (astuce pour tronquer un nom de fichier),
//   4. un morceau qui commence par un point → null (« .. » et « .git »),
//   5. un dossier (finit par « / ») → son index.html,
//   6. on assemble avec rootDir.
export function resolvePath(rootDir, urlPath) {
  // 1. Retirer la chaîne de requête et le fragment.
  const sansQuery = urlPath.split(/[?#]/)[0];

  // 2. Décoder les échappements du pourcentage (%20 → espace, etc.).
  let text;
  try {
    text = decodeURIComponent(sansQuery);
  } catch {
    return null; // Séquence %-xx mal formée (ex. %E0%A4%A) → refus.
  }

  // 3. L'octet null ne figure jamais dans un vrai nom de fichier.
  if (text.includes('\0')) {
    return null;
  }

  // 4. Interdire tout morceau qui commence par un point :
  //    « .. » sort du projet, « .git » expose le dépôt, etc.
  for (const morceau of text.split(/[\\/]/)) {
    if (morceau.startsWith('.')) {
      return null;
    }
  }

  // 5. Demander un dossier, c'est demander sa page d'accueil.
  if (text.endsWith('/')) {
    text += 'index.html';
  }

  // 6. Chemin absolu du fichier, dans le projet.
  return join(rootDir, text);
}

// Répondre avec un simple texte (utilisé pour les erreurs).
function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

// Servir une requête HTTP unique en renvoyant un fichier du projet.
async function handleRequest(rootDir, req, res) {
  // 1. Seules les méthodes GET et HEAD sont acceptées.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Méthode non autorisée');
    return;
  }

  // 2. Chemin qui sort du projet (ou mal formé) → refus.
  const chemin = resolvePath(rootDir, req.url);
  if (chemin === null) {
    send(res, 403, 'Accès refusé');
    return;
  }

  // 3. Lire le fichier puis l'envoyer avec les bons en-têtes.
  try {
    const contenu = await readFile(chemin);
    res.writeHead(200, {
      'Content-Type': contentType(chemin),
      // no-store : le navigateur ne garde pas en cache les modules,
      // sinon il pourrait rouler avec une ancienne version en développement.
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end(); // Comme GET, mais sans corps.
    } else {
      res.end(contenu);
    }
  } catch {
    // 4. Fichier absent (ou le chemin pointe vers un dossier) → 404.
    send(res, 404, 'Introuvable');
  }
}

// Créer et démarrer le serveur.
// La promesse est résolue avec le serveur quand l'écoute commence,
// rejetée à la première erreur (ex. port déjà utilisé).
// `127.0.0.1` limite l'accès à ce Mac.
export function startServer({ rootDir, port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleRequest(rootDir, req, res).catch(() => {
        // Le client a abandonné la requête (onglet fermé) : rien à faire.
      });
    });
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

// Lancement direct (`node tools/serve.mjs`) : servir le dossier du projet.
// Quand le module est importé (tests, outilleurs), rien ne se passe.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Racine du projet = le dossier parent de tools/.
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  startServer({ rootDir })
    .then(() => {
      console.log(`Zwift Bis : http://localhost:${DEFAULT_PORT} (Ctrl+C pour arrêter)`);
    })
    .catch((error) => {
      const message = error.code === 'EADDRINUSE'
        ? `Le port ${DEFAULT_PORT} est déjà utilisé`
        : error.message;
      console.error(message);
      process.exit(1);
    });
}
