// Tests du simulateur (étape 9) : un faux home-trainer piloté par une horloge factice.
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator, SIM_CADENCE_RPM } from '../src/devices/simulator.js';

// Horloge factice : le test déclenche les tics à la main via `t.callback()`.
function fakeTimers() {
  const t = {
    callback: null, intervalMs: null, setCount: 0, clearCount: 0,
    setInterval(fn, ms) { t.callback = fn; t.intervalMs = ms; t.setCount++; return 42; },
    clearInterval(id) { if (id === 42) { t.callback = null; t.clearCount++; } },
  };
  return t;
}

// Simulateur + horloge factice + une liste de toutes les données reçues.
function setup() {
  const timers = fakeTimers();
  const sim = createSimulator({ timers });
  const received = [];
  sim.onData((d) => received.push(d));
  return { timers, sim, received };
}

test('départ : état initial, cadence, pas de données sans connexion', () => {
  assert.equal(SIM_CADENCE_RPM, 90);
  const { sim, received } = setup();
  assert.deepEqual(sim.getState(), { connected: false, powerW: 0, cadenceRpm: 0, gradePct: 0, targetW: null });
  sim.setPower(200); // sans connexion : rien n'est envoyé
  assert.deepEqual(received, []);
});

test('connexion : une mesure immédiate, minuteur à 1000 ms, seconde connexion ignorée', async () => {
  const { timers, sim, received } = setup();
  await sim.connect();
  assert.equal(timers.intervalMs, 1000);
  assert.deepEqual(received, [{ powerW: 0, cadenceRpm: 0 }]);
  assert.equal(sim.getState().connected, true);
  await sim.connect();
  assert.equal(timers.setCount, 1);
  assert.equal(received.length, 1);
});

test('puissance : setPower n’envoie rien, la mesure part au prochain tic', async () => {
  const { timers, sim, received } = setup();
  await sim.connect();
  sim.setPower(200);
  assert.equal(received.length, 1); // la donnée ne part qu'au tic
  timers.callback(); // un tic d'horloge
  assert.deepEqual(received[1], { powerW: 200, cadenceRpm: 90 });
  // Arrondi et borne à 0 : setPower suivi d'un tic.
  const CAS = [
    [199.6, 200],
    [-5, 0],
    [0, 0],
  ];
  for (const [watts, attendu] of CAS) {
    sim.setPower(watts);
    timers.callback();
    assert.equal(received.at(-1).powerW, attendu);
  }
});

test('ERG : une cible remplace la puissance, une cible de 0 reste une cible', async () => {
  const { timers, sim, received } = setup();
  await sim.connect();

  sim.setPower(100);
  await sim.setTargetPower(150);
  timers.callback(); // un tic avant de lire le dernier reçu
  assert.deepEqual(received.at(-1), { powerW: 150, cadenceRpm: 90 });
  assert.equal(sim.getState().targetW, 150);

  await sim.setTargetPower(0);
  timers.callback();
  assert.deepEqual(received.at(-1), { powerW: 0, cadenceRpm: 0 });

  await sim.setTargetPower(150);
  await sim.setGrade(5); // suivre une pente fait quitter l'ERG
  timers.callback();
  assert.deepEqual(received.at(-1), { powerW: 100, cadenceRpm: 90 });
  assert.deepEqual(sim.getState(), { connected: true, powerW: 100, cadenceRpm: 90, gradePct: 5, targetW: null });
});

test('déconnexion : le minuteur s’arrête, puis on peut se reconnecter', async () => {
  const { timers, sim } = setup();
  await sim.connect();
  await sim.disconnect();
  assert.equal(timers.callback, null);
  assert.equal(timers.clearCount, 1);
  assert.equal(sim.getState().connected, false);
  await sim.disconnect(); // déjà déconnecté : rien à faire
  assert.equal(timers.clearCount, 1);
  await sim.connect();
  assert.equal(timers.setCount, 2);
});

test('désabonnement : la fonction renvoyée par onData retire l’abonné', async () => {
  // Simulateur créé sans setup, avec deux abonnés a et b.
  const timers = fakeTimers();
  const sim = createSimulator({ timers });
  let a = 0, b = 0;
  const retirerA = sim.onData(() => { a++; });
  sim.onData(() => { b++; });
  await sim.connect(); // mesure immédiate : a = 1, b = 1
  retirerA();
  timers.callback(); // un tic : seul b est prévenu
  assert.equal(a, 1);
  assert.equal(b, 2);
});
