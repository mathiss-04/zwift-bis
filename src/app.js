// Chef d'orchestre (étape 10) : fait rouler le vélo à l'écran.
// Une boucle à 20 Hz lit la puissance du trainer, fait avancer la sortie
// (stepRide) sur un parcours, et rafraîchit le HUD 4 fois par seconde.
//
// Ce module ne touche pas au DOM et ne démarre rien tout seul :
// index.html fait les branchements. Les horloges `now` et `timers`
// sont remplaçables pour que les tests contrôlent le temps.

import { createRide, stepRide } from './core/ride.js';

// Pas de physique : 50 ms, soit 20 calculs par seconde.
export const STEP_MS = 50;

// Rafraîchissement de l'affichage : 250 ms, soit 4 fois par seconde.
export const HUD_INTERVAL_MS = 250;

// Sans aucune donnée depuis 3 s, la puissance et la cadence valent 0.
export const DATA_TIMEOUT_MS = 3000;

// Rattrapage maximal en un seul tic : 5 s.
export const MAX_CATCHUP_MS = 5000;

/**
 * Crée la route fictive plate, en attendant les vrais parcours de l'étape 20.
 * `n = round(lengthM / stepM) + 1` points : le point i est à i × stepM.
 * Tout droit sur x, z à 0, altitude constante à 100 m, pente à 0.
 */
export function createFlatRoute({ lengthM = 10000, stepM = 10 } = {}) {
  const n = Math.round(lengthM / stepM) + 1; // nombre de points
  const x = [];
  const z = [];
  const alt = [];
  const grade = [];
  for (let i = 0; i < n; i++) {
    x.push(i * stepM); // position sur x (m) : i × stepM
    z.push(0); // tout droit : pas de déviation sur z
    alt.push(100); // altitude constante (m) : route parfaitement plate
    grade.push(0); // pente nulle (fraction) partout
  }
  return { isLoop: true, lengthM, stepM, x, z, alt, grade };
}

/**
 * Crée l'application.
 * - `trainer` : un trainer ou le simulateur (onData, connect, disconnect).
 * - `route` : le parcours, `params` : les paramètres physiques du cycliste.
 * - `hud` : un objet avec `render(view)`.
 * - `now` : horloge en ms (performance.now par défaut), remplaçable en test.
 * - `timers` : fournissent setInterval/clearInterval (globalThis par défaut).
 */
export function createApp({ trainer, route, params, hud, now = () => performance.now(), timers = globalThis }) {
  // État privé de l'application.
  let ride = createRide(route, params); // état de la sortie
  let powerW = 0; // dernière puissance reçue (W)
  let cadenceRpm = 0; // dernière cadence reçue (tr/min)
  let lastDataMs = null; // instant de la dernière mesure (ms) ; null = jamais
  let timerId = null; // identifiant du minuteur ; null = arrêté
  let lastTickMs = 0; // instant du tic précédent (ms)
  let lastHudMs = 0; // instant du dernier rendu HUD (ms)
  let pendingMs = 0; // temps réel à consommer en pas de physique (ms)

  // La mesure la plus récente est-elle encore fraîche ?
  // Pas de mesure, ou plus vieille que DATA_TIMEOUT_MS : non.
  function fresh(t) {
    return lastDataMs !== null && t - lastDataMs <= DATA_TIMEOUT_MS;
  }

  // Reçoit une mesure du trainer (éventuellement en morceaux :
  // une seule clé powerW ou une seule clé cadenceRpm).
  function receive(data) {
    if (data.powerW !== undefined) powerW = data.powerW;
    if (data.cadenceRpm !== undefined) cadenceRpm = data.cadenceRpm;
    lastDataMs = now(); // toute mesure, même partielle, repart le compteur
  }

  // On s'abonne aux mesures dès la création.
  trainer.onData(receive);

  // Photo de la sortie à l'instant présent, pour le HUD.
  // Si les données sont vieilles, puissance et cadence sont affichées à 0.
  function getView() {
    const t = now();
    return {
      speedKmh: ride.speedMs * 3.6, // m/s → km/h
      powerW: fresh(t) ? powerW : 0,
      cadenceRpm: fresh(t) ? cadenceRpm : 0,
      distanceM: ride.distanceM,
      timeS: ride.timeS,
      gradePct: ride.point.grade * 100, // fraction → pourcent
    };
  }

  // Un tic de la boucle (appelé par setInterval, environ toutes les 50 ms).
  function tick() {
    // 1. Instant présent.
    const t = now();

    // 2. On compte le temps réel écoulé depuis le tic précédent,
    //    plafonné à MAX_CATCHUP_MS : un minuteur n'est jamais ponctuel,
    //    et le plafond évite de bondir en avant après une mise en veille.
    pendingMs += Math.min(t - lastTickMs, MAX_CATCHUP_MS);
    lastTickMs = t;

    // 3. Puissance courante : 0 si la dernière mesure a vieilli.
    const p = fresh(t) ? powerW : 0;

    // 4. On consomme le temps en pas de physique fixes (STEP_MS).
    //    Le pas reste fixe, donc le résultat ne dépend pas de la
    //    régularité du minuteur : un tic lent refait plusieurs pas.
    while (pendingMs >= STEP_MS) {
      ride = stepRide(ride, p, STEP_MS / 1000);
      pendingMs -= STEP_MS;
    }

    // 5. Affichage : au plus une fois toutes les HUD_INTERVAL_MS.
    if (t - lastHudMs >= HUD_INTERVAL_MS) {
      hud.render(getView());
      lastHudMs = t;
    }
  }

  return {
    // Démarre la sortie : se connecte au trainer, calibre les horloges,
    // lance le minuteur, puis rend le HUD une première fois.
    async start() {
      if (timerId !== null) return; // déjà démarré : rien à faire
      await trainer.connect();
      lastTickMs = now(); // le temps écoulé part de zéro
      lastHudMs = lastTickMs;
      timerId = timers.setInterval(tick, STEP_MS);
      hud.render(getView());
    },

    // Arrête la sortie : retire le minuteur puis se déconnecte du trainer.
    async stop() {
      if (timerId === null) return; // déjà arrêté : rien à faire
      timers.clearInterval(timerId);
      timerId = null;
      await trainer.disconnect();
    },

    getView,
    tick,
  };
}
