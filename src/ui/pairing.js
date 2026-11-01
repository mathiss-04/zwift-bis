// Module d'appairage du Zwift Hub One (étape 11) : bouton « Connecter »,
// texte de statut et trames brutes lues sur le hub.
//
// Module sans import : il ne fait que brancher des événements entre le
// trainer (qui connaît le Bluetooth) et les éléments de la page.

export const MAX_FRAMES = 8; // nombre de trames affichées

/**
 * Traduit un statut de connexion en texte lisible par l'utilisateur.
 * Un statut inconnu est renvoyé tel quel, pour ne jamais perdre
 * l'information à l'écran.
 */
export function statusText(status) {
  const textes = {
    idle: 'Hub non connecté',
    searching: 'Choisis ton Hub dans la fenêtre du navigateur',
    connecting: 'Connexion au Hub…',
    connected: 'Hub connecté',
    disconnected: 'Hub déconnecté',
  };
  return textes[status] ?? status;
}

/**
 * Transforme une erreur du Web Bluetooth en message clair et actionnable.
 * Les noms d'erreurs sont définis par le navigateur (NotFoundError,
 * NetworkError, SecurityError, NotSupportedError) ; tout le reste
 * retombe sur un message générique avec le message d'origine.
 */
export function describeError(error) {
  const messages = {
    NotFoundError: "Aucun Hub sélectionné. S'il n'apparaît pas dans la liste, vérifie qu'il est allumé et que Zwift est bien fermé.",
    NetworkError: `Connexion au Hub impossible. Zwift l'utilise peut-être encore : ferme-le, puis réessaie.`,
    SecurityError: `Bluetooth refusé par le navigateur. Vérifie l'autorisation du site et l'adresse en HTTPS.`,
    NotSupportedError: 'Ce navigateur ne gère pas le Bluetooth : utilise Chrome ou Edge.',
  };
  return messages[error.name] ?? `Erreur Bluetooth : ${error.message}`;
}

/**
 * Crée l'écran d'appairage branché sur `trainer` et les éléments de la page.
 * `elements` porte les clés connect (bouton), status et frames.
 * `onConnect()` est appelé au clic ; `onError()` en cas d'échec.
 * Le module ne décide jamais quoi faire : il affiche et envoie au trainer.
 */
export function createPairing({ elements, trainer, onConnect, onError }) {
  // Statuts pendant lesquels le clic ne doit pas relancer la connexion.
  const statutsBloquants = new Set(['searching', 'connecting', 'connected']);

  // 1. Statut initial : le hub n'est pas encore connecté.
  elements.status.textContent = statusText('idle');

  // 2. Suivi du statut : texte à l'écran et bouton activé ou non.
  trainer.onStatus((s) => {
    elements.status.textContent = statusText(s);
    elements.connect.disabled = statutsBloquants.has(s);
  });

  // 3. Trames brutes : la plus récente en tête, liste limitée à MAX_FRAMES.
  let trames = [];
  trainer.onRaw((hex) => {
    trames.unshift(hex); // la trame la plus récente en tête
    if (trames.length > MAX_FRAMES) trames.length = MAX_FRAMES; // retire l'ancienne du bas
    elements.frames.textContent = trames.join('\n');
  });

  // 4. Clic sur le bouton : tentative de connexion, avec retour en arrière
  //    sur l'écran en cas d'échec.
  elements.connect.addEventListener('click', async () => {
    try {
      await onConnect();
    } catch (error) {
      elements.status.textContent = describeError(error);
      elements.connect.disabled = false; // on permet de réessayer
      await onError();
    }
  });
}
