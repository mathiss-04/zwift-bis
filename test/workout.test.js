// Tests du module de déroulé de séance (étape 4).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkout,
  totalDurationS,
  blockAt,
  targetFraction,
  targetPowerW,
  advance,
  pause,
  resume,
  adjustIntensity,
  isFinished,
} from '../src/core/workout.js';

// Séance d'exemple : 230 s au total, FTP de 200 W.
const BLOCKS = [
  { source: 'Warmup', type: 'ramp', durationS: 100, powerStart: 0.5, powerEnd: 1 },
  { source: 'SteadyState', type: 'steady', durationS: 60, powerStart: 0.8, powerEnd: 0.8 },
  { source: 'FreeRide', type: 'free', durationS: 30, powerStart: null, powerEnd: null },
  { source: 'Cooldown', type: 'ramp', durationS: 40, powerStart: 1, powerEnd: 0.6 },
];

// État fictif à un instant donné : utile pour targetPowerW et isFinished.
const at = (tS) => ({ ...createWorkout(BLOCKS, 200), elapsedS: tS });

test('createWorkout : état initial', () => {
  assert.deepEqual(createWorkout(BLOCKS, 200), {
    blocks: BLOCKS,
    ftpW: 200,
    elapsedS: 0,
    paused: false,
    intensitySteps: 0,
  });
});

test('totalDurationS : 230 s', () => {
  assert.equal(totalDurationS(BLOCKS), 230);
});

// Instants à vérifier sur la séance : le bloc attendu (3 champs), la puissance
// cible et la fin. Les deux dernières lignes sont après la fin (bloc `null`).
const ROWS = [
  { t: 0, index: 0, inBlockS: 0, remainingS: 100, power: 100, finished: false },
  { t: 50, index: 0, inBlockS: 50, remainingS: 50, power: 150, finished: false },
  { t: 99.5, index: 0, inBlockS: 99.5, remainingS: 0.5, power: 200, finished: false },
  { t: 100, index: 1, inBlockS: 0, remainingS: 60, power: 160, finished: false },
  { t: 159, index: 1, inBlockS: 59, remainingS: 1, power: 160, finished: false },
  { t: 160, index: 2, inBlockS: 0, remainingS: 30, power: null, finished: false },
  { t: 189, index: 2, inBlockS: 29, remainingS: 1, power: null, finished: false },
  { t: 190, index: 3, inBlockS: 0, remainingS: 40, power: 200, finished: false },
  { t: 210, index: 3, inBlockS: 20, remainingS: 20, power: 160, finished: false },
  { t: 229, index: 3, inBlockS: 39, remainingS: 1, power: 122, finished: false },
  { t: 230, index: null, inBlockS: null, remainingS: null, power: null, finished: true },
  { t: 500, index: null, inBlockS: null, remainingS: null, power: null, finished: true },
];

test('blockAt, targetPowerW et isFinished : parcours de la séance', () => {
  for (const row of ROWS) {
    const result = blockAt(BLOCKS, row.t);
    if (row.index === null) {
      // Après la fin de la séance : aucun bloc.
      assert.equal(result, null, `blockAt à t=${row.t} doit être null`);
    } else {
      assert.equal(result.index, row.index, `index à t=${row.t}`);
      assert.equal(result.inBlockS, row.inBlockS, `inBlockS à t=${row.t}`);
      assert.equal(result.remainingS, row.remainingS, `remainingS à t=${row.t}`);
    }
    assert.equal(targetPowerW(at(row.t)), row.power, `targetPowerW à t=${row.t}`);
    assert.equal(isFinished(at(row.t)), row.finished, `isFinished à t=${row.t}`);
  }
});

test('blockAt : un instant négatif est traité comme 0', () => {
  const result = blockAt(BLOCKS, -5);
  assert.equal(result.index, 0);
  assert.equal(result.inBlockS, 0);
});

test('targetFraction : interpolation linéaire', () => {
  assert.equal(targetFraction(BLOCKS[0], 0), 0.5);
  assert.equal(targetFraction(BLOCKS[0], 25), 0.625);
  assert.equal(targetFraction(BLOCKS[1], 30), 0.8);
  assert.equal(targetFraction(BLOCKS[2], 10), null);
  assert.equal(targetFraction(BLOCKS[3], 10), 0.9);
});

test("ajustement de l'intensité : pas de 5 %", () => {
  let s = advance(createWorkout(BLOCKS, 200), 120); // t = 120, bloc à 160 W
  assert.equal(s.intensitySteps, 0);
  assert.equal(targetPowerW(s), 160);

  s = adjustIntensity(s, 1);
  assert.equal(s.intensitySteps, 1);
  assert.equal(targetPowerW(s), 168);

  s = adjustIntensity(s, -3);
  assert.equal(s.intensitySteps, -2);
  assert.equal(targetPowerW(s), 144);
});

test("bornes de l'intensité : ±50 %", () => {
  const s0 = createWorkout(BLOCKS, 200);
  assert.equal(adjustIntensity(s0, 99).intensitySteps, 10);
  assert.equal(adjustIntensity(s0, -99).intensitySteps, -10);

  const s120 = advance(s0, 120); // bloc à 160 W
  assert.equal(targetPowerW(adjustIntensity(s120, 99)), 240);
  assert.equal(targetPowerW(adjustIntensity(s120, -99)), 80);
});

test("pause : le temps s'arrête, puis repart", () => {
  let s = advance(createWorkout(BLOCKS, 200), 10);
  s = pause(s);
  s = advance(s, 50);
  assert.equal(s.elapsedS, 10);

  s = resume(s);
  s = advance(s, 5);
  assert.equal(s.elapsedS, 15);
  assert.equal(s.paused, false);
});

test('advance : on ne dépasse pas la fin de la séance', () => {
  assert.equal(advance(createWorkout(BLOCKS, 200), 9999).elapsedS, 230);
});

test('advance : le temps ne recule pas', () => {
  assert.equal(advance(advance(createWorkout(BLOCKS, 200), 10), -5).elapsedS, 10);
});

test('advance : vingt pas de 0,05 s donnent 1 s', () => {
  let s = createWorkout(BLOCKS, 200);
  for (let i = 0; i < 20; i++) {
    s = advance(s, 0.05);
  }
  assert.ok(Math.abs(s.elapsedS - 1) < 0.000001);
});

test("pas de modification de l'état reçu", () => {
  const s = createWorkout(BLOCKS, 200);
  advance(s, 50);
  assert.equal(s.elapsedS, 0);
});
