// Module des zones d'effort (étape 2) : conversion puissance ↔ zones.
// Les zones sont bornées en fraction de la FTP (W).
//
// Module pur : pas d'écran, pas de Bluetooth, pas de classe, pas d'import.
// (Le champ `color` sera utilisé à l'étape 22 pour l'affichage.)

// maxFraction : limite haute exclue, en fraction de la FTP.
export const ZONES = [
  { zone: 1, name: 'Récupération', maxFraction: 0.60, color: '#808080' },
  { zone: 2, name: 'Endurance', maxFraction: 0.76, color: '#3b82f6' },
  { zone: 3, name: 'Tempo', maxFraction: 0.90, color: '#22c55e' },
  { zone: 4, name: 'Seuil', maxFraction: 1.05, color: '#eab308' },
  { zone: 5, name: 'VO2 max', maxFraction: 1.19, color: '#f97316' },
  { zone: 6, name: 'Anaérobie', maxFraction: Infinity, color: '#ef4444' },
];

/**
 * Zone correspondant à une puissance (W), pour une FTP (W).
 * f = powerW / ftpW ; on retourne la première zone de ZONES telle que f < maxFraction.
 * La limite haute est exclue : à 120 W pour 200 de FTP (f = 0,60), on est en zone 2.
 * Si ftpW <= 0 (FTP non renseignée) : zone 1.
 */
export function zoneForPower(powerW, ftpW) {
  if (ftpW <= 0) return ZONES[0];
  const f = powerW / ftpW; // puissance en fraction de la FTP
  return ZONES.find((z) => f < z.maxFraction);
}

/**
 * Plage de puissance (W) d'une zone (numéro de 1 à 6), pour une FTP (W).
 * minW = 0 pour la zone 1, sinon maxFraction de la zone précédente × ftpW.
 * maxW = maxFraction de la zone × ftpW, ou Infinity pour la zone 6.
 */
export function zoneRangeW(zone, ftpW) {
  const minW = zone === 1 ? 0 : ZONES[zone - 2].maxFraction * ftpW;
  const maxW = zone === 6 ? Infinity : ZONES[zone - 1].maxFraction * ftpW;
  return { minW, maxW };
}
