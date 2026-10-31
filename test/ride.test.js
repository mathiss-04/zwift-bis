// Tests du module d'état de sortie (étape 6).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createParams } from '../src/core/physics.js';
import { createRide, stepRide } from '../src/core/ride.js';

// Utilitaire : vérifie qu'« actual » est à « tol » près de « expected ».
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Fabrique un parcours de N points séparés de `step` mètres.
const makeRoute = (N, step, alt, grade, isLoop = true) => ({
  isLoop,
  lengthM: (N - 1) * step,
  stepM: step,
  x: Array.from({ length: N }, (_, i) => i * step),
  z: Array(N).fill(0),
  alt: Array.from({ length: N }, (_, i) => alt(i)),
  grade: Array.from({ length: N }, (_, i) => grade(i)),
});

// Enchaîne les pas de 0.05 s pendant durationS secondes.
function run(state, powerW, durationS, dtS = 0.05) {
  const n = Math.round(durationS / dtS);
  let s = state;
  for (let i = 0; i < n; i++) s = stepRide(s, powerW, dtS);
  return s;
}

const params = createParams(75, 8); // importé de physics.js
const FLAT = makeRoute(101, 10, () => 100, () => 0);             // boucle plate de 1000 m
const HILL = makeRoute(101, 10, (i) => 100 + i * 0.5, () => 0.05, false); // montée à 5 %, sans boucle
const PEAK = makeRoute(201, 10, (i) => 100 + (i <= 100 ? i : 200 - i), () => 0); // boucle de 2000 m : 100 m de D+, pente nulle

// Tableau principal : [fabrique d'état, timeS, distanceM, speedMs, ascentM, lap, posM, alt]
const CAS = [
  [() => run(createRide(FLAT, params), 200, 60), 60, 468.616, 9.3330, 0, 0, 468.616, 100],
  [() => run(createRide(FLAT, params), 200, 300), 300, 2730.140, 9.4287, 0, 2, 730.140, 100],
  [() => run(createRide(FLAT, params), 0, 60), 60, 0, 0, 0, 0, 0, 100],
  [() => run(createRide(HILL, params), 250, 60), 60, 279.444, 4.9941, 13.972, 0, 279.444, 113.972],
  [() => run(createRide(HILL, params), 0, 10), 10, 0, 0, 0, 0, 0, 100],
  [() => run(createRide(PEAK, params), 200, 600), 600, 5558.757, 9.4287, 299.939, 2, 1558.757, 144.124],
  [() => createRide(FLAT, params, 250), 0, 250, 0, 0, 0, 250, 100],
  [() => run(createRide(FLAT, params, 250), 200, 60), 60, 718.616, 9.3330, 0, 0, 718.616, 100],
  [() => stepRide(createRide(FLAT, params), 200, 0.05), 0.05, 0.003, 0.1135, 0, 0, 0.003, 100],
];

test('tableau principal : temps, distance, vitesse, D+, tour, position, altitude', () => {
  for (const [make, timeS, distanceM, speedMs, ascentM, lap, posM, alt] of CAS) {
    const s = make();
    near(s.timeS, timeS, 0.001);
    near(s.distanceM, distanceM, 0.001);
    near(s.speedMs, speedMs, 0.0001);
    near(s.ascentM, ascentM, 0.001);
    assert.equal(s.point.lap, lap); // égalité stricte sur le tour
    near(s.point.posM, posM, 0.001);
    near(s.point.alt, alt, 0.001);
  }
});

test('durée nulle : l’état est retourné tel quel', () => {
  const s = createRide(FLAT, params);
  assert.equal(stepRide(s, 200, 0) === s, true);
});

test('pas de modification de l’état reçu', () => {
  const s = createRide(FLAT, params);
  stepRide(s, 200, 1);
  assert.equal(s.timeS, 0);
});

test('la vitesse ne saute pas : vingt pas à 1000 W', () => {
  let s = run(createRide(FLAT, params), 200, 60);
  for (let i = 0; i < 20; i++) {
    const avant = s.speedMs;
    s = stepRide(s, 1000, 0.05);
    assert.ok(s.speedMs > avant, `la vitesse doit augmenter à chaque pas (${s.speedMs} après ${avant})`);
    assert.ok(s.speedMs - avant <= 0.05, `saut de ${(s.speedMs - avant).toFixed(4)} m/s, trop grand`);
  }
});
