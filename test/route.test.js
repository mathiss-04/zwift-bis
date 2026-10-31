// Tests du module de parcours en mémoire (étape 5).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRoute, lerp, pointAt } from '../src/core/route.js';

// Utilitaire : vérifie qu'« actual » est à « tol » près de « expected ».
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Boucle de 40 m, 5 points espacés de 10 m : le dernier point rejoint le premier.
const LOOP = {
  isLoop: true,
  lengthM: 40,
  stepM: 10,
  x: [0, 10, 10, 0, 0],
  z: [0, 0, -10, -10, 0],
  alt: [100, 101, 103, 101, 100],
  grade: [0.1, 0.2, 0, -0.2, 0.1],
};

// Même tracé, mais sans boucle : un parcours aller simple de 40 m.
const LINE = { ...LOOP, isLoop: false };

// pointAt sur la boucle : [distance, lap, posM, x, z, alt, grade]
const CAS_BOUCLE = [
  [0, 0, 0, 0, 0, 100, 0.1],
  [5, 0, 5, 5, 0, 100.5, 0.15],
  [10, 0, 10, 10, 0, 101, 0.2],
  [12.5, 0, 12.5, 10, -2.5, 101.5, 0.15],
  [25, 0, 25, 5, -10, 102, -0.1],
  [39, 0, 39, 0, -1, 100.1, 0.07],
  [40, 1, 0, 0, 0, 100, 0.1],
  [45, 1, 5, 5, 0, 100.5, 0.15],
  [80, 2, 0, 0, 0, 100, 0.1],
  [92.5, 2, 12.5, 10, -2.5, 101.5, 0.15],
  [-3, 0, 0, 0, 0, 100, 0.1],
  [1000000.5, 25000, 0.5, 0.5, 0, 100.05, 0.105],
];

test('pointAt sur la boucle : tour, position et interpolation', () => {
  for (const [distance, lap, posM, x, z, alt, grade] of CAS_BOUCLE) {
    const point = pointAt(LOOP, distance);
    assert.equal(point.lap, lap); // égalité stricte sur le tour
    near(point.posM, posM, 0.000001);
    near(point.x, x, 0.000001);
    near(point.z, z, 0.000001);
    near(point.alt, alt, 0.000001);
    near(point.grade, grade, 0.000001);
  }
});

// pointAt sans boucle : mêmes colonnes, le parcours s'arrête au dernier point.
const CAS_LIGNE = [
  [0, 0, 0, 0, 0, 100, 0.1],
  [25, 0, 25, 5, -10, 102, -0.1],
  [40, 0, 40, 0, 0, 100, 0.1],
  [99, 0, 40, 0, 0, 100, 0.1],
];

test('pointAt sans boucle : plafonné au dernier point', () => {
  for (const [distance, lap, posM, x, z, alt, grade] of CAS_LIGNE) {
    const point = pointAt(LINE, distance);
    assert.equal(point.lap, lap); // égalité stricte sur le tour
    near(point.posM, posM, 0.000001);
    near(point.x, x, 0.000001);
    near(point.z, z, 0.000001);
    near(point.alt, alt, 0.000001);
    near(point.grade, grade, 0.000001);
  }
});

// Tracé géolocalisé : les colonnes lat et lon (degrés) existent ici.
const GEO = { ...LOOP, lat: [45, 45.1, 45.2, 45.1, 45], lon: [5, 5, 5.1, 5.1, 5] };

test('pointAt avec lat/lon : interpolées de la même façon', () => {
  const a = pointAt(GEO, 5);
  near(a.lat, 45.05, 0.000001);
  near(a.lon, 5, 0.000001);
  const b = pointAt(GEO, 12.5);
  near(b.lat, 45.125, 0.000001);
  near(b.lon, 5.025, 0.000001);
});

test('pointAt sans lat/lon : les champs n’existent pas', () => {
  assert.equal('lat' in pointAt(LOOP, 5), false);
  assert.equal('lon' in pointAt(LOOP, 5), false);
});

test('lerp : début, milieu, fin', () => {
  assert.equal(lerp(10, 20, 0), 10);
  assert.equal(lerp(10, 20, 0.5), 15);
  assert.equal(lerp(10, 20, 1), 20);
});

test('validateRoute : parcours valide renvoyé tel quel', () => {
  assert.equal(validateRoute(LOOP) === LOOP, true);
});

test('validateRoute : les quatre erreurs exactes', () => {
  assert.throws(
    () => validateRoute({ ...LOOP, stepM: 0 }),
    { message: 'Parcours invalide : stepM doit être positif' },
  );
  assert.throws(
    () => validateRoute({ ...LOOP, alt: [1], x: [1], z: [1], grade: [1] }),
    { message: 'Parcours invalide : au moins 2 points requis' },
  );
  assert.throws(
    () => validateRoute({ ...LOOP, grade: [1, 2] }),
    { message: 'Parcours invalide : colonne grade de mauvaise longueur' },
  );
  assert.throws(
    () => validateRoute({ ...LOOP, lengthM: 50 }),
    { message: 'Parcours invalide : lengthM ne correspond pas à stepM' },
  );
});
