// Simulateur : un faux home-trainer pour développer sans matériel.
//
// Module pur : pas d'import, pas de DOM, pas de classe. Il envoie une mesure
// { powerW, cadenceRpm } à intervalle régulier, exactement comme le vera le
// vrai trainer de l'étape 11 (interface FTMS). Le paramètre `timers` permet
// aux tests de remplacer l'horloge par une qu'ils déclenchent à la main.

// Cadence affichée quand le cycliste développe de la puissance (tr/min).
export const SIM_CADENCE_RPM = 90;

// Puissance en watts, arrondie et bornée à 0 : on ne mesure pas de puissance négative.
function clampPower(w) {
  return Math.max(0, Math.round(w));
}

// Fabrique un simulateur.
// `intervalMs` : durée entre deux mesures envoyées (1 s par défaut).
// `timers` : objet fournissant setInterval/clearInterval (globalThis par défaut).
export function createSimulator({ intervalMs = 1000, timers = globalThis } = {}) {
  // État privé du simulateur.
  let riderPowerW = 0; // Puissance réellement développée par le cycliste (W).
  let targetW = null;  // Cible ERG en W ; null = pas de mode ERG.
  let gradePct = 0;    // Pente courante (pourcent).
  let timerId = null;  // Identifiant du minuteur ; null = déconnecté.
  const listeners = new Set(); // Fonctions à prévenir à chaque mesure.

  // Donnée courante, comme un vrai trainer :
  // une cible ERG remplace la puissance du cycliste, et une cible de 0 W
  // reste une cible (la cadence tombe donc à 0, comme en ERG à l'arrêt).
  function currentData() {
    const powerW = targetW ?? riderPowerW;
    const cadenceRpm = powerW > 0 ? SIM_CADENCE_RPM : 0;
    return { powerW, cadenceRpm };
  }

  // Prévenir tous les abonnés de la mesure courante.
  function emit() {
    const data = currentData();
    for (const callback of listeners) {
      callback(data);
    }
  }

  return {
    // Se connecter : lancer le minuteur (une mesure toutes les `intervalMs`)
    // et envoyer une mesure tout de suite pour ne pas attendre un tick.
    async connect() {
      if (timerId !== null) return; // Déjà connecté : rien à faire.
      timerId = timers.setInterval(emit, intervalMs);
      emit();
    },

    // Se déconnecter : arrêter le minuteur.
    async disconnect() {
      if (timerId === null) return; // Déjà déconnecté : rien à faire.
      timers.clearInterval(timerId);
      timerId = null;
    },

    // S'abonner aux mesures { powerW, cadenceRpm }.
    // Retourne une fonction qui retire l'abonné.
    onData(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    // Changer la pente (pourcent) : comme un vrai trainer, suivre une pente
    // fait quitter le mode ERG (la cible est annulée).
    async setGrade(pourcent) {
      gradePct = pourcent;
      targetW = null;
    },

    // Fixer une cible de puissance (W) : mode ERG.
    async setTargetPower(watts) {
      targetW = clampPower(watts);
    },

    // Fixer la puissance du cycliste (W). Particulier au simulateur :
    // n'envoie rien, la mesure partira au prochain tick du minuteur.
    setPower(watts) {
      riderPowerW = clampPower(watts);
    },

    // Photo complète de l'état, pour l'affichage et le suivi.
    getState() {
      const { powerW, cadenceRpm } = currentData();
      return {
        connected: timerId !== null,
        powerW,
        cadenceRpm,
        gradePct,
        targetW,
      };
    },
  };
}
