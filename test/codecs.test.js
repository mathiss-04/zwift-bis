// Tests des codecs Bluetooth (étape 8) : FTMS pour le home-trainer, Heart Rate pour la ceinture cardio.
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeRequestControl,
  encodeStart,
  encodeStop,
  encodePause,
  encodeTargetPower,
  encodeSimulation,
  decodeIndoorBikeData,
  decodeControlPointResponse,
} from '../src/core/ftms-codec.js';
import { decodeHeartRate } from '../src/core/hr-codec.js';

// Utilitaires : liste d'octets → DataView ; Uint8Array → liste d'octets (comparaison).
const dv = (bytes) => new DataView(Uint8Array.from(bytes).buffer);
const bytes = (u8) => [...u8];

// ---- Encodage des commandes vers le Control Point (FTMS) ----

test('encodage des commandes : contrôle, démarrage, arrêt, pause', () => {
  const cas = [
    [encodeRequestControl, [0]],
    [encodeStart, [7]],
    [encodeStop, [8, 1]],
    [encodePause, [8, 2]],
  ];
  for (const [fn, attendu] of cas) {
    assert.deepEqual(bytes(fn()), attendu);
  }
});

test('encodeTargetPower : puissance cible en watts (int16 signé, 1 W par unité)', () => {
  const cas = [
    [200, [5, 200, 0]],
    [250.4, [5, 250, 0]],
    [0, [5, 0, 0]],
    [-1, [5, 255, 255]],
  ];
  for (const [watts, attendu] of cas) {
    assert.deepEqual(bytes(encodeTargetPower(watts)), attendu);
  }
});

test('encodeSimulation : pente, vent, roulement, traînée (7 octets)', () => {
  const cas = [
    [() => encodeSimulation(5), [17, 0, 0, 244, 1, 40, 51]],
    [() => encodeSimulation(-5), [17, 0, 0, 12, 254, 40, 51]],
    [() => encodeSimulation(0), [17, 0, 0, 0, 0, 40, 51]],
    [() => encodeSimulation(16), [17, 0, 0, 64, 6, 40, 51]],
    [() => encodeSimulation(1.67), [17, 0, 0, 167, 0, 40, 51]],
    [() => encodeSimulation(5, { windMs: -2.5, crr: 0.005, cw: 0.6 }), [17, 60, 246, 244, 1, 50, 60]],
    [() => encodeSimulation(0, { crr: 0.1, cw: 9 }), [17, 0, 0, 0, 0, 255, 255]],
  ];
  for (const [appel, attendu] of cas) {
    assert.deepEqual(bytes(appel()), attendu);
  }
});

// ---- Décodage des données vélo d’intérieur (FTMS) ----

test('decodeIndoorBikeData : trames partielles (drapeaux, champs présents, troncature)', () => {
  const cas = [
    [[0x44, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0xC8, 0x00], { truncated: false, speedKmh: 10, cadenceRpm: 90, powerW: 200 }],
    [[0x64, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0x05, 0xC8, 0x00], { truncated: false, speedKmh: 10, cadenceRpm: 90, resistanceLevel: 5, powerW: 200 }],
    [[0x45, 0x00, 0xB4, 0x00, 0xC8, 0x00], { truncated: false, cadenceRpm: 90, powerW: 200 }],
    [[0x01, 0x00], { truncated: false }],
    [[0x41, 0x00, 0xF6, 0xFF], { truncated: false, powerW: -10 }],
    [[0x44, 0x00, 0xE8, 0x03, 0xB4], { truncated: true, speedKmh: 10 }],
    [[0x10, 0x00, 0xE8, 0x03, 0x01, 0x00, 0x01], { truncated: false, speedKmh: 10, distanceM: 65537 }],
  ];
  for (const [trame, attendu] of cas) {
    assert.deepEqual(decodeIndoorBikeData(dv(trame)), attendu);
  }
});

test('decodeIndoorBikeData : trame complète (tous les champs présents)', () => {
  const trame = [0xFF, 0x1F, 0xD0, 0x07, 0xA0, 0x00, 0x90, 0x00, 0x10, 0x27, 0x00, 0x0A, 0xFA, 0x00, 0xF0, 0x00, 0x64, 0x00, 0xE8, 0x03, 0x12, 0x8C, 0x2D, 0x3C, 0x00, 0x78, 0x00];
  assert.deepEqual(decodeIndoorBikeData(dv(trame)), { truncated: false, avgSpeedKmh: 20, cadenceRpm: 80, avgCadenceRpm: 72, distanceM: 10000, resistanceLevel: 10, powerW: 250, avgPowerW: 240, totalEnergyKcal: 100, energyPerHourKcal: 1000, energyPerMinKcal: 18, heartRateBpm: 140, met: 4.5, elapsedS: 60, remainingS: 120 });
});

test('decodeIndoorBikeData : taille de la résistance (1 ou 2 octets)', () => {
  const trame = [0x64, 0x00, 0xE8, 0x03, 0xB4, 0x00, 0x05, 0x00, 0xC8, 0x00];
  // Avec 2 octets (int16 signé), la puissance se lit à la bonne place.
  assert.deepEqual(decodeIndoorBikeData(dv(trame), { resistanceBytes: 2 }), { truncated: false, speedKmh: 10, cadenceRpm: 90, resistanceLevel: 5, powerW: 200 });
  // Sans option (1 octet), tout est décalé d’un octet : puissance fausse.
  assert.deepEqual(decodeIndoorBikeData(dv(trame)), { truncated: false, speedKmh: 10, cadenceRpm: 90, resistanceLevel: 5, powerW: -14336 });
});

// ---- Réponses du Control Point (FTMS) ----

test('decodeControlPointResponse : accusés de réception', () => {
  const cas = [
    [[0x80, 0x11, 0x01], { requestOpcode: 17, result: 1, ok: true }],
    [[0x80, 0x05, 0x05], { requestOpcode: 5, result: 5, ok: false }],
    [[0x12, 0x00, 0x01], null],
    [[0x80, 0x00], null],
  ];
  for (const [trame, attendu] of cas) {
    assert.deepEqual(decodeControlPointResponse(dv(trame)), attendu);
  }
});

// ---- Décodage de la ceinture cardio (Heart Rate) ----

test('decodeHeartRate : fréquence, contact, énergie, intervalles RR', () => {
  const cas = [
    [[0x00, 72], { heartRateBpm: 72, contactDetected: null, rrMs: [] }],
    [[0x01, 0x2C, 0x01], { heartRateBpm: 300, contactDetected: null, rrMs: [] }],
    [[0x06, 80], { heartRateBpm: 80, contactDetected: true, rrMs: [] }],
    [[0x04, 80], { heartRateBpm: 80, contactDetected: false, rrMs: [] }],
    [[0x08, 90, 0x10, 0x00], { heartRateBpm: 90, contactDetected: null, energyKj: 16, rrMs: [] }],
    [[0x10, 75, 0x00, 0x04, 0x00, 0x02], { heartRateBpm: 75, contactDetected: null, rrMs: [1000, 500] }],
    [[0x19, 0x90, 0x00, 0x20, 0x00, 0x00, 0x04], { heartRateBpm: 144, contactDetected: null, energyKj: 32, rrMs: [1000] }],
  ];
  for (const [trame, attendu] of cas) {
    assert.deepEqual(decodeHeartRate(dv(trame)), attendu);
  }
});
