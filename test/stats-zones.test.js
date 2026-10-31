// Tests des modules statistiques et zones (étape 2).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mean, trailingAverage, normalizedPower, ascentM } from '../src/core/stats.js';
import { zoneForPower, zoneRangeW } from '../src/core/zones.js';

// Comparaison avec une tolérance (arrondi).
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Tableau de n valeurs identiques.
const fill = (n, v) => Array(n).fill(v);

test('mean : somme divisée par le nombre', () => {
  assert.equal(mean([]), 0);
  assert.equal(mean([100, 200, 300]), 200);
});

test('trailingAverage : moyenne des n dernières valeurs', () => {
  assert.equal(trailingAverage([100, 200, 300, 400]), 300);
  assert.equal(trailingAverage([100, 200]), 150);
  assert.equal(trailingAverage([]), 0);
  assert.equal(trailingAverage([100, 200, 300, 400, 500], 5), 300);
});

test('normalizedPower : moins de 30 valeurs, ou série constante', () => {
  near(normalizedPower([]), 0, 0.001);
  near(normalizedPower(fill(29, 200)), 0, 0.001);
  near(normalizedPower(fill(30, 200)), 200, 0.001);
});

test('normalizedPower : alternance 150 W / 300 W (10 minutes)', () => {
  const series = [...fill(600, 150), ...fill(600, 300)];
  near(normalizedPower(series), 255.677, 0.001);
});

test('normalizedPower : 10 blocs de 300 W / 100 W (20 minutes)', () => {
  const series = Array.from({ length: 10 }, () => [...fill(60, 300), ...fill(60, 100)]).flat();
  near(normalizedPower(series), 239.372, 0.001);
});

test('normalizedPower : progression linéaire 100 → 395 W sur 60 s', () => {
  const series = Array.from({ length: 60 }, (_, i) => 100 + i * 5);
  near(normalizedPower(series), 258.924, 0.001);
});

test('ascentM : somme des montées uniquement', () => {
  assert.equal(ascentM([]), 0);
  assert.equal(ascentM([100]), 0);
  assert.equal(ascentM([100, 90, 80]), 0);
  assert.equal(ascentM([100, 110, 105, 120, 120, 90]), 25);
});

test('zoneForPower : ftpW = 200', () => {
  const ftpW = 200;
  const cas = [
    [0, 1],
    [119, 1],
    [120, 2],
    [151, 2],
    [152, 3],
    [179, 3],
    [180, 4],
    [209, 4],
    [210, 5],
    [237, 5],
    [238, 6],
    [1000, 6],
  ];
  for (const [powerW, zone] of cas) {
    assert.equal(zoneForPower(powerW, ftpW).zone, zone, `à ${powerW} W`);
  }
});

test('zoneForPower : FTP non renseignée', () => {
  assert.equal(zoneForPower(500, 0).zone, 1);
});

test('zoneRangeW : ftpW = 200', () => {
  const ftpW = 200;

  const z1 = zoneRangeW(1, ftpW);
  near(z1.minW, 0, 0.001);
  near(z1.maxW, 120, 0.001);

  const z4 = zoneRangeW(4, ftpW);
  near(z4.minW, 180, 0.001);
  near(z4.maxW, 210, 0.001);

  const z6 = zoneRangeW(6, ftpW);
  near(z6.minW, 238, 0.001);
  assert.equal(z6.maxW, Infinity);
});
