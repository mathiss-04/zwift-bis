// Tests du module physique (étape 1).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createParams,
  gravityForce,
  rollingForce,
  dragForce,
  totalResistance,
  powerForSpeed,
  steadySpeed,
  acceleration,
  stepSpeed,
} from '../src/core/physics.js';

// Comparaison avec une tolérance (arrondi).
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Cycliste de 75 kg sur un vélo de 8 kg : 83 kg au total.
const p = createParams(75, 8);

test('createParams : masse et overrides', () => {
  assert.equal(p.massKg, 83);
  assert.equal(p.cda, 0.32);
  assert.equal(createParams(75, 8, { cda: 0.25 }).cda, 0.25);
});

test('forces : pesanteur', () => {
  near(gravityForce(83, 0, 9.81), 0, 0.001);
  near(gravityForce(83, 0.05, 9.81), 40.661, 0.001);
  near(gravityForce(83, 0.10, 9.81), 81.019, 0.001);
  near(gravityForce(83, -0.05, 9.81), -40.661, 0.001);
});

test('forces : roulement', () => {
  near(rollingForce(83, 0, 0.004, 9.81), 3.257, 0.001);
  near(rollingForce(83, 0.05, 0.004, 9.81), 3.253, 0.001);
  near(rollingForce(83, 0.10, 0.004, 9.81), 3.241, 0.001);
});

test('forces : traînée de l\'air', () => {
  near(dragForce(0, 0.32, 1.225), 0, 0.001);
  near(dragForce(10, 0.32, 1.225), 19.600, 0.001);
  near(dragForce(15, 0.32, 1.225), 44.100, 0.001);
});

test('totalResistance : somme des trois forces', () => {
  near(totalResistance(10, 0, p), 22.857, 0.001);
  near(totalResistance(10, 0.05, p), 63.514, 0.001);
  near(totalResistance(10, -0.05, p), -17.808, 0.001);
});

test('powerForSpeed : puissance pour tenir une vitesse', () => {
  near(powerForSpeed(10, 0, p), 234.430, 0.001);
  near(powerForSpeed(5, 0.05, p), 250.326, 0.001);
  near(powerForSpeed(20, -0.05, p), 840.865, 0.001);
});

test('steadySpeed : vitesse stabilisée', () => {
  near(steadySpeed(100, 0, p), 7.226, 0.001);
  near(steadySpeed(200, 0, p), 9.429, 0.001);
  near(steadySpeed(300, 0, p), 10.943, 0.001);
  near(steadySpeed(200, 0.05, p), 4.127, 0.001);
  near(steadySpeed(250, 0.05, p), 4.995, 0.001);
  near(steadySpeed(300, 0.10, p), 3.381, 0.001);
  near(steadySpeed(0, 0, p), 0, 0.001);
  near(steadySpeed(-50, 0, p), 0, 0.001);
  near(steadySpeed(0, -0.002, p), 0, 0.001); // le roulement retient
  near(steadySpeed(0, -0.05, p), 13.815, 0.001); // vitesse limite en roue libre
  near(steadySpeed(0, -0.10, p), 19.921, 0.001); // vitesse limite en roue libre
  near(steadySpeed(200, -0.05, p), 15.917, 0.001);
});

test('steadySpeed / powerForSpeed : aller-retour', () => {
  near(powerForSpeed(steadySpeed(200, 0, p), 0, p), 200, 0.001);
  near(powerForSpeed(steadySpeed(250, 0.05, p), 0.05, p), 250, 0.001);
});

test('acceleration', () => {
  near(acceleration(0, 200, 0, p), 2.2692, 0.0001);
  near(acceleration(10, 200, 0, p), -0.0397, 0.0001);
  near(acceleration(10, 0, 0, p), -0.2705, 0.0001);
  near(acceleration(10, -100, 0, p), -0.2705, 0.0001);
  near(acceleration(0, 0, -0.05, p), 0.4427, 0.0001);
});

test('stepSpeed : un seul appel', () => {
  near(stepSpeed(10, 200, 0, 0, p), 10, 0.0001); // durée nulle
  near(stepSpeed(0, 0, 0, 0.05, p), 0, 0.0001); // reste à l'arrêt
  near(stepSpeed(0, 0, 0.05, 1, p), 0, 0.0001); // pas de recul en montée
  near(stepSpeed(0, 0, -0.05, 1, p), 0.4426, 0.0001); // démarre seul en descente
  near(stepSpeed(10, 200, 0, 0.05, p), 9.9980, 0.0001); // un pas
  near(stepSpeed(10, 200, 0, 1, p), 9.9615, 0.0001); // découpage en 10 pas
});

// Utilitaire : fait tourner stepSpeed en boucle pendant `durationS` secondes.
function simulate(v0, powerW, grade, durationS, stepS = 0.05) {
  const n = Math.round(durationS / stepS);
  let v = v0;
  for (let i = 0; i < n; i++) {
    v = stepSpeed(v, powerW, grade, stepS, p);
  }
  return v;
}

test('simulation : stepSpeed en boucle', () => {
  near(simulate(0, 200, 0, 10), 6.132, 0.002);
  near(simulate(0, 200, 0, 60), 9.333, 0.002);
  near(simulate(0, 200, 0, 300), 9.429, 0.002);
  near(simulate(15, 0, 0, 30), 6.659, 0.002);
  near(simulate(15, 0, 0, 60), 3.704, 0.002);
  near(simulate(0, 0, -0.05, 10), 4.282, 0.002);
  near(simulate(0, 0, -0.05, 300), 13.815, 0.002);
  near(simulate(0, 0, -0.10, 300), 19.921, 0.002);
  near(simulate(12, 250, 0.05, 120), 4.995, 0.002);
});

test('inertie : 1000 W, la vitesse augmente doucement', () => {
  let v = 10; // 10 m/s à plat
  for (let i = 0; i < 100; i++) {
    const vNext = stepSpeed(v, 1000, 0, 0.05, p);
    assert.ok(vNext > v, `pas ${i} : la vitesse doit augmenter (de ${v} à ${vNext})`);
    assert.ok(vNext - v <= 0.05, `pas ${i} : augmentation de ${vNext - v} m/s, trop forte`);
    v = vNext;
  }
});
