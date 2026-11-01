// Module d'affichage HUD (étape 10) : formate les valeurs de la sortie
// (vitesse, puissance, cadence, distance, temps, pente) puis les écrit
// dans les éléments de la page.
//
// Module pur : pas d'import, pas de minuteur, pas de classe.
// La virgule est le séparateur décimal français.

/**
 * Arrondit `v` à `n` décimales puis l'écrit avec une virgule.
 * Le `+ 0` évite d'afficher « -0,0 » pour une valeur proche de zéro
 * (Math.round(-0,4) donne -0, qui s'afficherait « -0,0 »).
 */
function decimal(v, n) {
  return (Math.round(v * 10 ** n) / 10 ** n + 0).toFixed(n).replace('.', ',');
}

/** Vitesse (km/h) : 1 décimale. */
export function formatSpeed(kmh) {
  return decimal(kmh, 1) + ' km/h';
}

/** Puissance (W) : nombre entier. */
export function formatPower(watts) {
  return Math.round(watts) + ' W';
}

/** Cadence (tr/min) : nombre entier. */
export function formatCadence(rpm) {
  return Math.round(rpm) + ' tr/min';
}

/** Distance : convertit les mètres en kilomètres (2 décimales). */
export function formatDistance(m) {
  return decimal(m / 1000, 2) + ' km';
}

/** Pente (pourcent) : 1 décimale. */
export function formatGrade(pct) {
  return decimal(pct, 1) + ' %';
}

/**
 * Formate une durée (s) en texte.
 * 1. t = floor(max(0, s) + 0.001) : les durées négatives sont ramenées à 0,
 *    et le 0.001 absorbe les erreurs d'arrondi (59,9999999 s compte pour 60 s).
 * 2. h, m et e sont les heures, minutes et secondes entières.
 * 3. Avec des heures : « h:mm:ss », sans heures : « m:ss »,
 *    mm et ss complétés à deux chiffres avec padStart.
 */
export function formatDuration(s) {
  const t = Math.floor(Math.max(0, s) + 0.001);
  const h = Math.floor(t / 3600); // heures entières
  const m = Math.floor((t % 3600) / 60); // minutes
  const e = t % 60; // secondes
  const mm = String(m).padStart(2, '0');
  const ss = String(e).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Crée un HUD branché sur les éléments de la page.
 * `elements` porte les clés speed, power, cadence, distance, time, grade,
 * chacune pointant vers un élément du DOM (écriture via textContent).
 * `render(view)` écrit la vue courante dans chaque élément.
 */
export function createHud(elements) {
  return {
    render(view) {
      elements.speed.textContent = formatSpeed(view.speedKmh);
      elements.power.textContent = formatPower(view.powerW);
      elements.cadence.textContent = formatCadence(view.cadenceRpm);
      elements.distance.textContent = formatDistance(view.distanceM);
      elements.time.textContent = formatDuration(view.timeS);
      elements.grade.textContent = formatGrade(view.gradePct);
    },
  };
}
