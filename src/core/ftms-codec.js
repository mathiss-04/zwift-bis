// Codecs FTMS (Fitness Machine) : traduction octets ↔ valeurs du home-trainer.
//
// Module pur : pas de Bluetooth, pas de classe, pas d'import.
// Convention : tous les nombres sur plusieurs octets sont petit-boutistes
// (l'octet de poids faible d'abord). Encodage → Uint8Array, décodage → DataView.

// Clamp : borne une valeur entre min et max (bornes incluses).
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

/**
 * Demande de contrôle de la machine (case Control Point).
 * Octet 0 = 0x00 : « je demande à piloter ce home-trainer ».
 */
export function encodeRequestControl() {
  return new Uint8Array([0x00]);
}

/**
 * Commande de démarrage (opercode 0x07).
 */
export function encodeStart() {
  return new Uint8Array([0x07]);
}

/**
 * Commande d'arrêt (opercode 0x08, paramètre 1 = arrêt).
 */
export function encodeStop() {
  return new Uint8Array([0x08, 0x01]);
}

/**
 * Commande de pause (opercode 0x08, paramètre 2 = pause).
 */
export function encodePause() {
  return new Uint8Array([0x08, 0x02]);
}

/**
 * Puissance cible (opercode 0x05) : 3 octets.
 * Octet 0 = 0x05, octets 1-2 = puissance en entier signé 16 bits (W),
 * arrondie au watt le plus proche et bornée entre -32768 et 32767.
 */
export function encodeTargetPower(watts) {
  const out = new Uint8Array(3);
  const view = new DataView(out.buffer);
  view.setUint8(0, 0x05); // opcode de la puissance cible
  const valeur = clamp(Math.round(watts), -32768, 32767); // watts, 1 W par unité
  view.setInt16(1, valeur, true); // petit-boutiste
  return out;
}

/**
 * Mode simulation (opercode 0x11) : 7 octets.
 * - vent en mm/s : windMs × 1000, entier signé 16 bits (m/s → mm/s) ;
 * - pente en 0,01 % : gradePct × 100, entier signé 16 bits ;
 * - coefficient de roulement Crr : crr × 10000, entier naturel 8 bits ;
 * - coefficient de traînée Cw : cw × 100, entier naturel 8 bits.
 * Les valeurs sont arrondies puis bornées pour tenir dans leur format.
 */
export function encodeSimulation(gradePct, { windMs = 0, crr = 0.004, cw = 0.51 } = {}) {
  const out = new Uint8Array(7);
  const view = new DataView(out.buffer);
  view.setUint8(0, 0x11); // opcode du mode simulation
  const vent = clamp(Math.round(windMs * 1000), -32768, 32767); // mm/s
  view.setInt16(1, vent, true);
  const pente = clamp(Math.round(gradePct * 100), -32768, 32767); // 0,01 %
  view.setInt16(3, pente, true);
  const roulement = clamp(Math.round(crr * 10000), 0, 255); // 0,0001 par unité
  view.setUint8(5, roulement);
  const trainee = clamp(Math.round(cw * 100), 0, 255); // 0,01 par unité
  view.setUint8(6, trainee);
  return out;
}

/**
 * Décode les données vélo d'intérieur (characteristic Indoor Bike Data).
 *
 * Octets 0-1 = drapeaux (uint16 petit-boutiste) : un bit par champ.
 * Les champs sont ensuite lus dans l'ordre des bits, à partir de l'octet 2.
 * Particularité du protocole : le bit 0 (vitesse) est INVERSÉ,
 * le champ est présent quand ce bit vaut 0.
 *
 * `resistanceBytes` : taille du champ résistance (1 ou 2 octets).
 * Le vrai Hub en envoie 2 : c'est l'appelant qui choisit cette valeur.
 *
 * Si la trame est tronquée (pas assez d'octets pour un champ annoncé),
 * `truncated` passe à true et l'on renvoie ce qui a déjà été lu, sans erreur.
 */
export function decodeIndoorBikeData(dataView, { resistanceBytes = 1 } = {}) {
  const result = { truncated: false };
  const flags = dataView.getUint16(0, true);
  let offset = 2;

  // Champs dans l'ordre du protocole. `inverted` marque le bit 0 (vitesse).
  // Chaque `read` reçoit l'offset du champ et renvoie l'offset suivant.
  const fields = [
    { bit: 0, inverted: true, size: 2,
      read: (o) => { result.speedKmh = dataView.getUint16(o, true) * 0.01; return o + 2; } }, // km/h
    { bit: 1, inverted: false, size: 2,
      read: (o) => { result.avgSpeedKmh = dataView.getUint16(o, true) * 0.01; return o + 2; } }, // km/h
    { bit: 2, inverted: false, size: 2,
      read: (o) => { result.cadenceRpm = dataView.getUint16(o, true) * 0.5; return o + 2; } }, // tr/min
    { bit: 3, inverted: false, size: 2,
      read: (o) => { result.avgCadenceRpm = dataView.getUint16(o, true) * 0.5; return o + 2; } }, // tr/min
    { bit: 4, inverted: false, size: 3,
      // uint24 : bas 16 bits + haut 8 octet × 65536, en mètres.
      read: (o) => { result.distanceM = dataView.getUint16(o, true) + dataView.getUint8(o + 2) * 65536; return o + 3; } },
    { bit: 5, inverted: false, size: resistanceBytes,
      // Taille variable : 1 octet (unsigned) ou 2 octets (signé 16 bits).
      read: (o) => {
        result.resistanceLevel = resistanceBytes === 2 ? dataView.getInt16(o, true) : dataView.getUint8(o);
        return o + resistanceBytes;
      } },
    { bit: 6, inverted: false, size: 2,
      read: (o) => { result.powerW = dataView.getInt16(o, true); return o + 2; } }, // watts
    { bit: 7, inverted: false, size: 2,
      read: (o) => { result.avgPowerW = dataView.getInt16(o, true); return o + 2; } }, // watts
    { bit: 8, inverted: false, size: 5,
      // Trois sous-champs : énergie totale (kcal), par heure (kcal/h), par minute (kcal/min).
      read: (o) => {
        result.totalEnergyKcal = dataView.getUint16(o, true);
        result.energyPerHourKcal = dataView.getUint16(o + 2, true);
        result.energyPerMinKcal = dataView.getUint8(o + 4);
        return o + 5;
      } },
    { bit: 9, inverted: false, size: 1,
      read: (o) => { result.heartRateBpm = dataView.getUint8(o); return o + 1; } }, // bpm
    { bit: 10, inverted: false, size: 1,
      read: (o) => { result.met = dataView.getUint8(o) * 0.1; return o + 1; } }, // MET, 0,1 par unité
    { bit: 11, inverted: false, size: 2,
      read: (o) => { result.elapsedS = dataView.getUint16(o, true); return o + 2; } }, // secondes
    { bit: 12, inverted: false, size: 2,
      read: (o) => { result.remainingS = dataView.getUint16(o, true); return o + 2; } }, // secondes
  ];

  for (const field of fields) {
    const bitSet = (flags >> field.bit) & 1;
    const present = field.inverted ? bitSet === 0 : bitSet === 1;
    if (!present) continue; // champ absent : on ne lit rien
    if (dataView.byteLength - offset < field.size) {
      result.truncated = true; // trame incomplète : on garde ce qui est lu
      break;
    }
    offset = field.read(offset);
  }

  return result;
}

/**
 * Décode la réponse du Control Point (reçu après une commande).
 * `null` si la trame fait moins de 3 octets ou si l'octet 0 n'est pas 0x80.
 * Sinon : requestOpcode = opcodec de la commande demandée,
 * result = code de résultat (1 = succès), ok = (result === 1).
 */
export function decodeControlPointResponse(dataView) {
  if (dataView.byteLength < 3) return null;
  if (dataView.getUint8(0) !== 0x80) return null;
  const requestOpcode = dataView.getUint8(1);
  const result = dataView.getUint8(2);
  return { requestOpcode, result, ok: result === 1 };
}
