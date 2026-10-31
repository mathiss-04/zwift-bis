// Module d'état de sortie (étape 6) : combine la physique et le parcours.
// À chaque pas de temps, il lit la pente à la position actuelle, fait
// évoluer la vitesse, avance sur le parcours et cumule le dénivelé positif.
//
// Module pur : pas d'écran, pas de minuteur, pas de classe.
// Chaque appel retourne un nouvel état ; l'état reçu n'est jamais modifié.
//
// Unités SI : distances et altitudes en m, vitesse en m/s, puissance en W,
// temps en s, pente (grade) en fraction (0.05 = 5 %).

import { stepSpeed } from './physics.js';
import { pointAt } from './route.js';

/**
 * Crée l'état initial d'une sortie sur un parcours.
 * `startDistanceM` : position de départ sur le parcours (m, 0 par défaut).
 * La vitesse, le dénivelé et l'heure partent de zéro ; seul le point
 * de départ est calculé sur le parcours.
 */
export function createRide(route, params, startDistanceM = 0) {
  const p = pointAt(route, startDistanceM);
  return {
    route,
    params,
    timeS: 0, // durée écoulée depuis le départ (s)
    distanceM: Math.max(0, startDistanceM), // distance totale parcourue (m)
    speedMs: 0, // vitesse actuelle (m/s)
    ascentM: 0, // dénivelé positif cumulé (m)
    point: p, // position actuelle sur le parcours { lap, posM, x, z, alt, grade }
  };
}

/**
 * Fait avancer la sortie de `dtS` secondes avec une puissance `powerW` (W),
 * et retourne un nouvel état. L'état reçu n'est pas modifié.
 * 1. Un pas nul ou négatif ne fait rien : on retourne l'état reçu tel quel.
 * 2. La pente vient du point actuel sur le parcours.
 * 3. La vitesse évolue grâce à la physique (stepSpeed).
 * 4. La distance avancée avec la vitesse moyenne du pas :
 *    (vitesse début + vitesse fin) / 2 × dtS (aire d'un trapèze).
 * 5. La position est recalculée sur le parcours à la nouvelle distance.
 * 6. Le dénivelé positif n'augmente que si l'altitude a monté.
 */
export function stepRide(state, powerW, dtS) {
  // 1. Pas nul : rien à calculer, on garde exactement le même objet.
  if (dtS <= 0) {
    return state;
  }

  // 2. Pente (fraction) lue au point actuel du parcours.
  const grade = state.point.grade;

  // 3. Nouvelle vitesse (m/s) après dtS sur cette pente.
  const v = stepSpeed(state.speedMs, powerW, grade, dtS, state.params);

  // 4. Nouvelle distance (m) : vitesse moyenne du pas × durée du pas.
  const d = state.distanceM + ((state.speedMs + v) / 2) * dtS;

  // 5. Nouveau point du parcours à cette distance (x, z, alt, grade, lap…).
  const p = pointAt(state.route, d);

  // 6. Dénivelé positif (m) : on ne compte que la montée, pas la descente.
  const ascentM = state.ascentM + Math.max(0, p.alt - state.point.alt);

  // 7. Nouvel état : route et params sont conservés tels quels.
  return {
    route: state.route,
    params: state.params,
    timeS: state.timeS + dtS,
    distanceM: d,
    speedMs: v,
    ascentM,
    point: p,
  };
}
