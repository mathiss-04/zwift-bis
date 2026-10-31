// Module de déroulé de séance (étape 4).
// À partir de la liste de blocs produite par zwo.js, dit à tout instant
// quel bloc est en cours, quelle puissance viser et combien de temps il reste.
// Gère aussi la pause et l'ajustement de l'intensité par pas de 5 %.
//
// Module pur : chaque fonction retourne un nouvel état,
// et ne modifie jamais celui qu'elle reçoit. Pas de classe, pas d'import.

/** Pas d'intensité : un appui = 5 % de la cible. */
export const INTENSITY_STEP = 0.05;

/** Limite d'ajustement : ±10 pas, soit ±50 %. */
export const MAX_INTENSITY_STEPS = 10;

/**
 * Crée l'état initial d'une séance.
 * `blocks` : liste de blocs au format de parseZwo, `ftpW` : FTP en watts.
 * `intensitySteps` compte les appuis (en entier) : on évite ainsi
 * d'accumuler des erreurs d'arrondi sur 0.05.
 */
export function createWorkout(blocks, ftpW) {
  return { blocks, ftpW, elapsedS: 0, paused: false, intensitySteps: 0 };
}

/**
 * Durée totale de la séance, en secondes : somme des durationS des blocs.
 */
export function totalDurationS(blocks) {
  return blocks.reduce((total, b) => total + b.durationS, 0);
}

/**
 * Identifie le bloc en cours à l'instant t (secondes depuis le début).
 * On parcourt les blocs en cumulant leur durée.
 * Règle des bords : un instant t appartient au bloc si début <= t < fin,
 * c'est-à-dire que le début d'un bloc lui appartient, sa fin au suivant.
 * Retourne `{ index, block, inBlockS, remainingS }`,
 * ou `null` si t est après la fin de la séance.
 */
export function blockAt(blocks, tS) {
  // t négatif (montre qui démarre avant la séance) : on le traite comme 0.
  const t = Math.max(0, tS);
  let start = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const end = start + block.durationS;
    if (t < end) {
      return { index: i, block, inBlockS: t - start, remainingS: end - t };
    }
    start = end;
  }
  // t est à ou après la fin de la séance.
  return null;
}

/**
 * Fraction de la FTP à viser dans le bloc, à l'instant `inBlockS` de son départ.
 * `null` si le bloc est en roue libre. Sinon, interpolation linéaire :
 * puissance = powerStart + (powerEnd - powerStart) × inBlockS / durationS.
 */
export function targetFraction(block, inBlockS) {
  if (block.type === 'free') return null;
  return block.powerStart + (block.powerEnd - block.powerStart) * inBlockS / block.durationS;
}

/**
 * Facteur d'intensité : 1 + 5 % par appui, borné par MAX_INTENSITY_STEPS.
 * Exemple : 2 appui → 1.10, -3 appui → 0.85.
 */
export function intensityFactor(state) {
  return 1 + INTENSITY_STEP * state.intensitySteps;
}

/**
 * Puissance cible à viser, en watts (nombre entier), à l'instant de l'état.
 * `null` si la séance est finie ou si le bloc en cours est en roue libre.
 */
export function targetPowerW(state) {
  const a = blockAt(state.blocks, state.elapsedS);
  if (a === null) return null;
  const f = targetFraction(a.block, a.inBlockS);
  if (f === null) return null;
  return Math.round(f * state.ftpW * intensityFactor(state));
}

/**
 * Fait avancer la séance de dtS secondes.
 * Retourne l'état inchangé si elle est en pause. Sinon, nouvel état où
 * `elapsedS` avance, sans reculer (dtS négatif → 0) ni dépasser la fin.
 */
export function advance(state, dtS) {
  if (state.paused) return state;
  const next = Math.min(state.elapsedS + Math.max(0, dtS), totalDurationS(state.blocks));
  return { ...state, elapsedS: next };
}

/** Met la séance en pause (nouvel état, `paused` = true). */
export function pause(state) {
  return { ...state, paused: true };
}

/** Reprend la séance (nouvel état, `paused` = false). */
export function resume(state) {
  return { ...state, paused: false };
}

/**
 * Ajuste l'intensité de la séance de `deltaSteps` pas (+1 = +5 %, -1 = -5 %).
 * Le nombre de pas est borné entre -MAX_INTENSITY_STEPS et +MAX_INTENSITY_STEPS.
 */
export function adjustIntensity(state, deltaSteps) {
  const steps = Math.max(-MAX_INTENSITY_STEPS, Math.min(MAX_INTENSITY_STEPS, state.intensitySteps + deltaSteps));
  return { ...state, intensitySteps: steps };
}

/**
 * La séance est-elle finie ? Oui si le temps écoulé atteint
 * (ou dépasse) la durée totale.
 */
export function isFinished(state) {
  return state.elapsedS >= totalDurationS(state.blocks);
}
