// Codecs Heart Rate (HRM) : décodage de la mesure de la ceinture cardio.
//
// Module pur : pas de Bluetooth, pas de classe, pas d'import.
// Convention : nombres multi-octets petit-boutistes ; on reçoit un DataView.

/**
 * Décode une mesure cardio (characteristic Heart Rate Measurement).
 *
 * Octet 0 = drapeaux, lecture à partir de l'octet 1 :
 * - bit 0 à 0 : fréquence cardiaque en uint8 ; bit 0 à 1 : en uint16.
 * - contactDetected : null si le bit 2 vaut 0 (capteur non compatible),
 *   sinon true si le bit 1 vaut 1 (en contact), false s'il vaut 0.
 * - bit 3 à 1 : énergie dépensée en kJ (uint16), sinon la clé n'existe pas.
 * - bit 4 à 1 : tous les uint16 restants sont des intervalles RR
 *   exprimés en 1/1024 s, convertis en ms : valeur × 1000 / 1024.
 *   `rrMs` est un tableau, vide si le bit vaut 0.
 */
export function decodeHeartRate(dataView) {
  const flags = dataView.getUint8(0);
  let offset = 1;

  // Fréquence cardiaque (battements/min) : 8 bits ou 16 bits selon le bit 0.
  const heartRateBpm = (flags & 0x01) === 0x00
    ? dataView.getUint8(offset)
    : dataView.getUint16(offset, true);
  offset += (flags & 0x01) === 0x00 ? 1 : 2;

  // Contact capteur : bit 2 à 0 → capteur non compatible (null).
  const contactDetected = (flags & 0x04) === 0x00
    ? null
    : (flags & 0x02) !== 0x00; // bit 1 à 1 → en contact

  // Énergie dépensée (kJ), uniquement si le bit 3 est à 1.
  let energyKj;
  if ((flags & 0x08) !== 0x00) {
    energyKj = dataView.getUint16(offset, true);
    offset += 2;
  }

  // Intervalles RR : tous les uint16 restants, en 1/1024 s → ms.
  const rrMs = [];
  if ((flags & 0x10) !== 0x00) {
    while (offset + 1 < dataView.byteLength) {
      const valeur = dataView.getUint16(offset, true); // 1/1024 de seconde
      rrMs.push((valeur * 1000) / 1024); // conversion en millisecondes
      offset += 2;
    }
  }

  const result = { heartRateBpm, contactDetected, rrMs };
  if (energyKj !== undefined) result.energyKj = energyKj;
  return result;
}
