// Module de commande de résistance (étape 7).
// Décide quelle consigne envoyer au home-trainer : une pente ou une puissance.
// - En sortie libre (mode 'free') : le trainer reçoit la pente réelle,
//   réduite par la difficulté de l'effort, bornée à ±16 %.
// - En séance (mode 'erg') : il reçoit la puissance cible (targetW).
//   Pendant un bloc FreeRide, targetW est null : on repasse sur la pente.
//
// Module pur : chaque fonction retourne un nouvel objet de consigne,
// sans effet de bord. La physique de la vitesse n'est jamais concernée
// par ce module : c'est le travail de physics.js.
//
// Conventions d'unités :
// - `grade` est une fraction (0.05 = 5 %).
// - `gradePct` est en pourcent (5 = 5 %) : c'est l'unité attendue par setGrade.
// - `difficulty` va de 0 à 1 (0.5 = 50 %).
//
// Une consigne est un objet de l'un de ces deux types :
// { type: 'grade', gradePct: 5 }
// { type: 'power', watts: 200 }
//
// Module pur : pas de classe, pas d'import.

/** Difficulté par défaut : 50 % de la pente réelle. */
export const DEFAULT_DIFFICULTY = 0.5;

/** Borne d'application de la pente sur le trainer : ±16 % (±0.16 en fraction). */
export const MAX_GRADE_PCT = 16;

/**
 * Borne la difficulté entre 0 et 1.
 * Protège contre les valeurs sortant de l'intervalle (1.5 → 1, -1 → 0).
 */
export function clampDifficulty(difficulty) {
  return Math.min(1, Math.max(0, difficulty));
}

/**
 * Construit la consigne de pente à envoyer au home-trainer.
 * 1. On convertit la fraction en pourcent et on applique la difficulté :
 *    pct = grade × 100 × difficulté bornée entre 0 et 1.
 *    La difficulté s'applique avant la borne : une pente de 40 % à 50 %
 *    de difficulté donne 20 %, qui est ensuite ramenée à 16 %.
 * 2. On borne le pourcent entre -16 % et +16 % : c'est la plage
 *    d'application réelle d'un home-trainer.
 * 3. On arrondit à 0,01 % près, la précision du protocole :
 *    Math.round(pct * 100) / 100. Le « + 0 » transforme un éventuel
 *    -0 en 0 (en JavaScript, -0 === 0 est vrai mais ils ne sont
 *    pas identiques : -0 === -0 alors que Object.is(-0, 0) est faux).
 */
export function gradeCommand(grade, difficulty) {
  let pct = grade * 100 * clampDifficulty(difficulty);
  pct = Math.min(MAX_GRADE_PCT, Math.max(-MAX_GRADE_PCT, pct));
  const gradePct = Math.round(pct * 100) / 100 + 0;
  return { type: 'grade', gradePct };
}

/**
 * Construit la consigne de puissance à envoyer au home-trainer.
 * On arrondit aux watts entiers et on borne en dessous à 0 :
 * une puissance négative n'a pas de sens sur un home-trainer.
 * Une cible de 0 W reste une cible (récupération complète).
 */
export function powerCommand(watts) {
  return { type: 'power', watts: Math.max(0, Math.round(watts)) };
}

/**
 * Choisit la consigne à envoyer selon le mode et la cible de puissance.
 * `state` porte : `mode` ('free' ou 'erg'), `grade` (fraction),
 * `difficulty` (0 à 1) et `targetW` (watts, ou null/absent en FreeRide).
 *
 * - En erg, si `targetW` est ni null ni absent : consigne de puissance.
 *   On teste la présence (null/undefined) et non la valeur :
 *   une cible de 0 W doit rester une consigne de puissance.
 * - Sinon (sortie libre, ou bloc FreeRide d'une séance) : consigne de pente.
 */
export function commandFor({ mode, grade, difficulty, targetW }) {
  if (mode === 'erg' && targetW !== null && targetW !== undefined) {
    return powerCommand(targetW);
  }
  return gradeCommand(grade, difficulty);
}

/**
 * Dit si deux consignes sont identiques, pour éviter de renvoyer
 * la même consigne au trainer à chaque frame.
 * Retourne false si l'une des deux est null ou undefined,
 * ou si leurs `type` diffèrent.
 * Sinon compare la valeur porteuse : `gradePct` pour le type 'grade',
 * `watts` pour le type 'power'.
 */
export function sameCommand(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === 'grade') {
    return a.gradePct === b.gradePct;
  }
  return a.watts === b.watts;
}
