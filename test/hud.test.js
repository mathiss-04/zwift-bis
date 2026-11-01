import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSpeed, formatPower, formatCadence, formatDistance, formatGrade, formatDuration, createHud } from '../src/ui/hud.js';

// Les valeurs attendues sont déjà calculées et vérifiées : on les recopie telles quelles.

// --- formatSpeed : km/h, un décimal, virgule française ---

test('formatSpeed(0)', () => {
  assert.equal(formatSpeed(0), '0,0 km/h');
});

test('formatSpeed(33.94)', () => {
  assert.equal(formatSpeed(33.94), '33,9 km/h');
});

test('formatSpeed(9.96)', () => {
  assert.equal(formatSpeed(9.96), '10,0 km/h');
});

// --- formatPower : watts, entier ---

test('formatPower(199.6)', () => {
  assert.equal(formatPower(199.6), '200 W');
});

test('formatPower(0)', () => {
  assert.equal(formatPower(0), '0 W');
});

// --- formatCadence : tours par minute, entier ---

test('formatCadence(89.5)', () => {
  assert.equal(formatCadence(89.5), '90 tr/min');
});

// --- formatDistance : km, deux décimaux ---

test('formatDistance(0)', () => {
  assert.equal(formatDistance(0), '0,00 km');
});

test('formatDistance(2730.14)', () => {
  assert.equal(formatDistance(2730.14), '2,73 km');
});

test('formatDistance(12345)', () => {
  assert.equal(formatDistance(12345), '12,35 km');
});

// --- formatGrade : pourcentage, un décimal ---

test('formatGrade(0)', () => {
  assert.equal(formatGrade(0), '0,0 %');
});

test('formatGrade(5.04)', () => {
  assert.equal(formatGrade(5.04), '5,0 %');
});

test('formatGrade(-0.04)', () => {
  assert.equal(formatGrade(-0.04), '0,0 %');
});

test('formatGrade(-5)', () => {
  assert.equal(formatGrade(-5), '-5,0 %');
});

// --- formatDuration : m:ss ou h:mm:ss ---

test('formatDuration(0)', () => {
  assert.equal(formatDuration(0), '0:00');
});

test('formatDuration(59.9)', () => {
  assert.equal(formatDuration(59.9), '0:59');
});

test('formatDuration(59.9999999)', () => {
  assert.equal(formatDuration(59.9999999), '1:00');
});

test('formatDuration(60)', () => {
  assert.equal(formatDuration(60), '1:00');
});

test('formatDuration(605)', () => {
  assert.equal(formatDuration(605), '10:05');
});

test('formatDuration(3661)', () => {
  assert.equal(formatDuration(3661), '1:01:01');
});

test('formatDuration(-5)', () => {
  assert.equal(formatDuration(-5), '0:00');
});

// --- createHud : des objets vides à la place des éléments du DOM ---

test('createHud : render met à jour les textContent des éléments', () => {
  const elements = {
    speed: {},
    power: {},
    cadence: {},
    distance: {},
    time: {},
    grade: {},
  };
  const hud = createHud(elements);
  hud.render({ speedKmh: 33.94, powerW: 200, cadenceRpm: 90, distanceM: 2730.14, timeS: 300, gradePct: 0 });

  assert.equal(elements.speed.textContent, '33,9 km/h');
  assert.equal(elements.power.textContent, '200 W');
  assert.equal(elements.cadence.textContent, '90 tr/min');
  assert.equal(elements.distance.textContent, '2,73 km');
  assert.equal(elements.time.textContent, '5:00');
  assert.equal(elements.grade.textContent, '0,0 %');
});
