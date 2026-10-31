// Module physique (étape 1) : forces et vitesse du cycliste.
// À partir de la puissance et de la pente, il calcule les forces
// et fait évoluer la vitesse.
//
// Module pur : pas d'écran, pas de Bluetooth, pas de classe, pas d'import.
//
// Unités SI : masse en kg, force en N, vitesse en m/s, puissance en W, temps en s.
// La pente `grade` est une fraction : 0.05 = 5 %, négative en descente.

// Vitesse plancher (m/s) pour le calcul P / v : évite une division par zéro au démarrage.
export const SPEED_FLOOR_MS = 1;

// Durée maximale d'un sous-pas de calcul (s) : plus les pas sont courts, plus le résultat est fidèle.
export const MAX_SUBSTEP_S = 0.1;

/**
 * Crée le jeu de paramètres physiques du cycliste.
 * `riderKg` : masse du cycliste (kg), `bikeKg` : masse du vélo (kg).
 * `overrides` : valeurs à remplacer (par exemple un cda plus petit).
 * `massKg` est calculé après les overrides : on ne peut pas le remplacer.
 */
export function createParams(riderKg, bikeKg, overrides = {}) {
  return {
    g: 9.81,             // pesanteur (m/s²)
    rho: 1.225,          // densité de l'air (kg/m³)
    crr: 0.004,          // coefficient de roulement (sans unité)
    cda: 0.32,           // surface aérodynamique cycliste + vélo (m²)
    eta: 0.975,          // rendement de transmission (sans unité)
    rotatingMassKg: 1.5, // masse équivalente des roues en rotation (kg)
    ...overrides,        // valeurs remplacées par l'appelant, si fournies
    massKg: riderKg + bikeKg, // masse totale = cycliste + vélo (kg)
  };
}

/**
 * Composante de la pesanteur le long de la route (N).
 * F = massKg × g × sin(atan(grade))
 * Positive en montée (elle freine), négative en descente (elle accélère).
 * Rappel : sin(atan(grade)) équivaut à grade / sqrt(1 + grade²).
 */
export function gravityForce(massKg, grade, g) {
  return massKg * g * Math.sin(Math.atan(grade));
}

/**
 * Force de roulement (N) : la résistance des pneus et de la route.
 * F = crr × massKg × g × cos(atan(grade))
 * Toujours positive : rouler coûte toujours de l'énergie.
 */
export function rollingForce(massKg, grade, crr, g) {
  return crr * massKg * g * Math.cos(Math.atan(grade));
}

/**
 * Force de traînée de l'air (N). Pas de vent.
 * F = 0.5 × rho × cda × speedMs²
 * Elle croît avec le carré de la vitesse : doubler la vitesse quadruple la force.
 */
export function dragForce(speedMs, cda, rho) {
  return 0.5 * rho * cda * speedMs * speedMs;
}

/**
 * Résistance totale du milieu (N) : pesanteur + roulement + air,
 * calculées avec les valeurs du paramètre `params`.
 * Peut être négative en descente : c'est la route qui « pousse » le cycliste.
 */
export function totalResistance(speedMs, grade, params) {
  return (
    gravityForce(params.massKg, grade, params.g) +
    rollingForce(params.massKg, grade, params.crr, params.g) +
    dragForce(speedMs, params.cda, params.rho)
  );
}

/**
 * Puissance au pédalier (W) nécessaire pour tenir cette vitesse.
 * P = totalResistance × speedMs / eta
 * On divise par le rendement : il y a des pertes dans la transmission,
 * il faut donc pédaler un peu plus fort.
 * Peut être négative en descente : il faudrait « freiner » pour rester à cette vitesse.
 */
export function powerForSpeed(speedMs, grade, params) {
  return (totalResistance(speedMs, grade, params) * speedMs) / params.eta;
}

/**
 * Vitesse stabilisée (m/s) : celle où la puissance nécessaire égale la puissance fournie.
 * Trouvée par dichotomie : on encadre la solution entre lo et hi, puis on la resserre.
 */
export function steadySpeed(powerW, grade, params) {
  const P = Math.max(0, powerW); // une puissance négative est traitée comme un effort nul
  let lo = 0;
  let hi = 1;

  // 1. On double hi tant que la puissance nécessaire à hi est inférieure à P
  //    (et que hi reste sous 200 m/s, soit ~720 km/h : largement hors sujet).
  while (powerForSpeed(hi, grade, params) <= P && hi < 200) {
    hi = hi * 2;
  }

  // 2. Soixante itérations : à chaque fois, on garde la moitié de l'intervalle
  //    qui contient la solution (la puissance nécessaire est croissante avec la vitesse).
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (powerForSpeed(mid, grade, params) > P) {
      hi = mid; // à mi-chemin il faudrait trop de puissance : la solution est en dessous
    } else {
      lo = mid; // à mi-chemin il ne faut pas plus que P : la solution est au-dessus
    }
  }

  // 3. Le milieu de l'intervalle final : précision ~ hi / 2^60, largement suffisante.
  return (lo + hi) / 2;
}

/**
 * Accélération (m/s²) à un instant donné.
 * Force motrice : drive = eta × P / max(speedMs, SPEED_FLOOR_MS), avec P = max(0, powerW).
 * Accélération : a = (drive − totalResistance) / (massKg + rotatingMassKg).
 * Le plancher SPEED_FLOOR_MS évite une division par zéro quand on est à l'arrêt ;
 * les roues en rotation (rotatingMassKg) ajoutent de l'inertie.
 */
export function acceleration(speedMs, powerW, grade, params) {
  const P = Math.max(0, powerW);
  const drive = (params.eta * P) / Math.max(speedMs, SPEED_FLOOR_MS);
  const inertie = params.massKg + params.rotatingMassKg;
  return (drive - totalResistance(speedMs, grade, params)) / inertie;
}

/**
 * Fait avancer la vitesse de `dtS` secondes (méthode d'Euler).
 * Découpage en n = max(1, ceil(dtS / MAX_SUBSTEP_S)) sous-pas de durée h = dtS / n :
 * un pas trop long fausserait le calcul quand la vitesse change vite.
 * La vitesse est bornée à 0 en dessous : un cycliste ne recule pas.
 */
export function stepSpeed(speedMs, powerW, grade, dtS, params) {
  const n = Math.max(1, Math.ceil(dtS / MAX_SUBSTEP_S));
  const h = dtS / n;
  let v = speedMs;
  for (let i = 0; i < n; i++) {
    v = Math.max(0, v + acceleration(v, powerW, grade, params) * h);
  }
  return v;
}
