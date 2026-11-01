// Étape 10 — tests de l'application : boucle de simulation, données du hub,
// rattrapage plafonné, fréquence du HUD, démarrage et arrêt.
// Chaque test crée son propre setup() et commence par `await s.app.start()`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp, createFlatRoute, STEP_MS, HUD_INTERVAL_MS, DATA_TIMEOUT_MS, MAX_CATCHUP_MS } from '../src/app.js';
import { validateRoute } from '../src/core/route.js';
import { createParams } from '../src/core/physics.js';

// Vérifie qu'`actual` est dans `expected` ± `tol` (mêmes unités de part et d'autre).
function near(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} au lieu de ${expected} ±${tol}`);
}

// Fausse horloge, faux timers, faux hub, faux HUD.
function setup() {
  const clock = { ms: 0 };
  const timers = {
    setCount: 0, clearCount: 0, intervalMs: null, callback: null,
    setInterval(fn, ms) { timers.callback = fn; timers.intervalMs = ms; timers.setCount++; return 7; },
    clearInterval(id) { if (id === 7) { timers.callback = null; timers.clearCount++; } },
  };
  const trainer = {
    cb: null, connected: 0, disconnected: 0,
    onData(cb) { trainer.cb = cb; },
    async connect() { trainer.connected++; },
    async disconnect() { trainer.disconnected++; },
  };
  const renders = [];
  const hud = { render(view) { renders.push(view); } };
  const app = createApp({
    trainer, route: createFlatRoute(), params: createParams(75, 8), hud,
    now: () => clock.ms, timers,
  });
  const send = (powerW, cadenceRpm = 90) => trainer.cb({ powerW, cadenceRpm });
  // Avance de durMs par pas de 50 ms. Si `watts` est fourni, envoie une mesure à chaque seconde.
  const run = (durMs, watts) => {
    for (let e = STEP_MS; e <= durMs; e += STEP_MS) {
      clock.ms += STEP_MS;
      if (watts !== undefined && clock.ms % 1000 === 0) send(watts);
      app.tick();
    }
  };
  return { clock, timers, trainer, renders, app, send, run };
}

test('Constantes', () => {
  assert.equal(STEP_MS, 50);
  assert.equal(HUD_INTERVAL_MS, 250);
  assert.equal(DATA_TIMEOUT_MS, 3000);
  assert.equal(MAX_CATCHUP_MS, 5000);
});

test('createFlatRoute', () => {
  const r = createFlatRoute();
  assert.equal(validateRoute(r), r); // une route valide est renvoyée telle quelle
  assert.equal(r.isLoop, true);
  assert.equal(r.lengthM, 10000);
  assert.equal(r.alt.length, 1001); // une cote tous les 10 m sur 10 000 m
  assert.equal(r.grade[500], 0); // route plate
  assert.equal(createFlatRoute({ lengthM: 100, stepM: 10 }).x[10], 100);
});

test('Roulage à 200 W', async () =>
  // 60 s de roulage à 200 W / 90 tr/min sur route plate.
  {
    let s = setup();
    await s.app.start();
    s.send(200);
    s.run(60000, 200);
    let v = s.app.getView();
    near(v.speedKmh, 33.599, 0.01);
    near(v.distanceM, 468.616, 0.001);
    near(v.timeS, 60, 0.001);
    assert.equal(v.powerW, 200);
    assert.equal(v.cadenceRpm, 90);
    assert.equal(v.gradePct, 0);
  });

test('Roulage à 200 W pendant 300 s', async () =>
  // Même roulage sur 300 s : la vitesse a presque atteint le régime de croisière.
  {
    const s = setup();
    await s.app.start();
    s.send(200);
    s.run(300000, 200);
    const v = s.app.getView();
    near(v.speedKmh, 33.943, 0.01);
    near(v.distanceM, 2730.140, 0.001);
    near(v.timeS, 300, 0.001);
    assert.equal(v.powerW, 200);
    assert.equal(v.cadenceRpm, 90);
    assert.equal(v.gradePct, 0);
  });

test('Pas de saut', async () => {
  const s = setup();
  await s.app.start();
  s.send(200);
  let prev = s.app.getView().speedKmh;
  for (let i = 0; i < 1200; i++) {
    s.run(50, 200);
    const speed = s.app.getView().speedKmh;
    assert.ok(speed > prev, `vitesse ${speed} km/h pas plus grande que le précédent ${prev} km/h`);
    assert.ok(speed - prev < 0.45, `écart ${speed - prev} km/h d'un pas à l'autre, supérieur à 0.45`);
    prev = speed;
  }
});

test('Sans aucune donnée', async () => {
  const s = setup();
  await s.app.start();
  assert.equal(s.app.getView().powerW, 0); // sans mesure du hub, la puissance vaut 0
  s.run(1000);
  const v = s.app.getView();
  assert.equal(v.speedKmh, 0);
  assert.equal(v.distanceM, 0);
  near(v.timeS, 1, 0.000001);
});

test('Plus de données', async () => {
  const s = setup();
  await s.app.start();
  s.send(200);
  s.run(3000); // la dernière mesure date de t = 3000 ms, encore valide
  let v = s.app.getView();
  assert.equal(v.powerW, 200);
  assert.equal(v.cadenceRpm, 90);
  s.run(50); // t = 3050 ms : la mesure a expiré (DATA_TIMEOUT_MS = 3000)
  v = s.app.getView();
  assert.equal(v.powerW, 0);
  assert.equal(v.cadenceRpm, 0);
  s.send(150); // une nouvelle mesure rétablit la puissance
  assert.equal(s.app.getView().powerW, 150);
});

test('Mesure en morceaux', async () => {
  const s = setup();
  await s.app.start();
  s.send(200, 90);
  s.trainer.cb({ cadenceRpm: 80 }); // message partiel : seule la cadence
  let v = s.app.getView();
  assert.equal(v.powerW, 200);
  assert.equal(v.cadenceRpm, 80);
  s.trainer.cb({ powerW: 210 }); // message partiel : seule la puissance
  v = s.app.getView();
  assert.equal(v.powerW, 210);
  assert.equal(v.cadenceRpm, 80);
});

test('Minuteur irrégulier', async () => {
  const s = setup();
  await s.app.start();
  // Avancement de l'horloge (ms) puis temps simulé attendu (s), ligne par ligne.
  const pas = [[70, 0.05], [70, 0.1], [70, 0.2], [40, 0.25]];
  for (const [avance, attendu] of pas) {
    s.clock.ms += avance;
    s.app.tick();
    near(s.app.getView().timeS, attendu, 0.000001);
  }
});

test('Rattrapage plafonné', async () => {
  const s = setup();
  await s.app.start();
  s.send(200);
  s.clock.ms += 1000;
  s.app.tick();
  near(s.app.getView().timeS, 1, 0.000001);
  s.clock.ms += 60000;
  s.app.tick();
  near(s.app.getView().timeS, 6, 0.000001); // 5 s rattrapées, pas 60
});

test('Fréquence du HUD', async () => {
  const s = setup();
  await s.app.start();
  assert.equal(s.renders.length, 1);
  s.run(200); // t = 200 ms : pas encore 250 ms
  assert.equal(s.renders.length, 1);
  s.run(50); // t = 250 ms : un second rendu
  assert.equal(s.renders.length, 2);
  s.run(750); // t = 1000 ms
  assert.equal(s.renders.length, 5);
  near(s.renders[4].timeS, 1, 0.000001);
});

test('Démarrage et arrêt', async () => {
  const s = setup();
  await s.app.start();
  await s.app.start(); // un second start() ne re-connecte pas
  assert.equal(s.trainer.connected, 1);
  assert.equal(s.timers.setCount, 1);
  assert.equal(s.timers.intervalMs, 50);
  await s.app.stop();
  assert.equal(s.trainer.disconnected, 1);
  assert.equal(s.timers.clearCount, 1);
  await s.app.stop(); // un second stop() ne re-déconnecte pas
  assert.equal(s.trainer.disconnected, 1);
});
