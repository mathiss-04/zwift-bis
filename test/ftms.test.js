// Étape 11 — tests du lecteur FTMS : connexion au Hub, trames brutes, mesures,
// déconnexion, coupure du Hub, échecs.
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.

import test from 'node:test';
import assert from 'node:assert/strict';

import { FTMS_SERVICE, INDOOR_BIKE_DATA, frameToHex, createFtmsTrainer } from '../src/devices/ftms.js';

const dv = (b) => new DataView(Uint8Array.from(b).buffer);

class Target {
  listeners = {};
  addEventListener(t, f) { (this.listeners[t] ??= new Set()).add(f); }
  removeEventListener(t, f) { this.listeners[t]?.delete(f); }
  fire(t) { for (const f of [...(this.listeners[t] ?? [])]) f({ target: this }); }
  count(t) { return this.listeners[t]?.size ?? 0; }
}

// `failures` : { étape: nomDeLErreur }. Étapes : request, gatt, service, characteristic, notify.
function fakeBluetooth(failures = {}) {
  const log = [];
  const devices = [];
  function step(name) {
    if (failures[name]) throw Object.assign(new Error(failures[name]), { name: failures[name] });
    log.push(name);
  }
  function newDevice() {
    const ch = new Target();
    ch.send = (b) => { ch.value = dv(b); ch.fire('characteristicvaluechanged'); };
    ch.startNotifications = async () => step('notify');
    const service = { getCharacteristic: async () => { step('characteristic'); return ch; } };
    const server = { getPrimaryService: async () => { step('service'); return service; } };
    const d = new Target();
    d.ch = ch;
    d.disconnects = 0;
    d.gatt = { connect: async () => { step('gatt'); return server; }, disconnect() { d.disconnects++; } };
    devices.push(d);
    return d;
  }
  return {
    log, devices, options: null, requests: 0,
    async requestDevice(o) { this.options = o; this.requests++; step('request'); return newDevice(); },
  };
}

function setup(failures) {
  const bluetooth = fakeBluetooth(failures);
  const trainer = createFtmsTrainer({ bluetooth });
  const data = [], raw = [], status = [];
  trainer.onData((d) => data.push(d));
  trainer.onRaw((h) => raw.push(h));
  trainer.onStatus((s) => status.push(s));
  return { bluetooth, trainer, data, raw, status };
}

// --- Constantes ---

test('constantes : service FTMS et caractéristique Indoor Bike', () => {
  assert.equal(FTMS_SERVICE, 0x1826);
  assert.equal(INDOOR_BIKE_DATA, 0x2ad2);
});

// --- frameToHex ---

test('frameToHex : octets en hexadécimal séparés par des espaces', () => {
  assert.equal(frameToHex(dv([0x44, 0, 0xE8, 3])), '44 00 E8 03');
  assert.equal(frameToHex(dv([])), '');
});

// --- Connexion ---

test('connect : séquence complète puis deuxième appel sans effet', async () => {
  const s = setup();
  await s.trainer.connect();
  assert.deepEqual(s.bluetooth.options, { filters: [{ services: [0x1826] }] });
  assert.deepEqual(s.bluetooth.log, ['request', 'gatt', 'service', 'characteristic', 'notify']);
  assert.deepEqual(s.status, ['searching', 'connecting', 'connected']);
  await s.trainer.connect(); // déjà connecté : ne fait rien
  assert.equal(s.bluetooth.requests, 1);
});

// --- Trames ---

// [trame, trame brute attendue, données attendues]
const TRAMES = [
  [[0x44, 0, 0xE8, 3, 0xB4, 0, 0xC8, 0], '44 00 E8 03 B4 00 C8 00', [{ powerW: 200, cadenceRpm: 90 }]],
  [[0x41, 0, 0xC8, 0], '41 00 C8 00', [{ powerW: 200 }]],
  [[0x05, 0, 0xB4, 0], '05 00 B4 00', [{ cadenceRpm: 90 }]],
  [[0x64, 0, 0xE8, 3, 0xB4, 0, 5, 0xC8, 0], '64 00 E8 03 B4 00 05 C8 00', [{ powerW: 200, cadenceRpm: 90 }]],
  [[0x01, 0], '01 00', []],
  [[0x00, 0, 0xE8, 3], '00 00 E8 03', []],
  [[0x44, 0, 0xE8, 3, 0xB4], '44 00 E8 03 B4', []],
];

test('trames : lecture des mesures du Hub', async () => {
  const s = setup();
  await s.trainer.connect();
  const c = s.bluetooth.devices[0].ch;
  for (const [trame, bruteAttendue, donneesAttendues] of TRAMES) {
    s.data.length = 0;
    c.send(trame);
    assert.equal(s.raw.at(-1), bruteAttendue);
    assert.deepEqual(s.data, donneesAttendues);
  }
});

test('trame avec résistance sur 2 octets', async () => {
  const bluetooth = fakeBluetooth();
  const trainer = createFtmsTrainer({ bluetooth, resistanceBytes: 2 });
  const data = [];
  trainer.onData((d) => data.push(d));
  await trainer.connect();
  bluetooth.devices[0].ch.send([0x64, 0, 0xE8, 3, 0xB4, 0, 5, 0, 0xC8, 0]);
  assert.deepEqual(data, [{ powerW: 200, cadenceRpm: 90 }]);
});

// --- Déconnexion ---

test('disconnect avant toute connexion : aucun statut', async () => {
  const s = setup();
  await s.trainer.disconnect();
  assert.deepEqual(s.status, []);
});

test('disconnect après connexion', async () => {
  const s = setup();
  await s.trainer.connect();
  await s.trainer.disconnect();
  const d = s.bluetooth.devices[0];
  assert.equal(d.disconnects, 1);
  assert.equal(s.status.length, 4);
  assert.equal(s.status.at(-1), 'disconnected');
  assert.equal(d.ch.count('characteristicvaluechanged'), 0);
  assert.equal(d.count('gattserverdisconnected'), 0);
  d.ch.send([0x44, 0, 0xE8, 3, 0xB4, 0, 0xC8, 0]); // plus d'écouteur : rien ne part
  assert.deepEqual(s.raw, []);
  await s.trainer.disconnect(); // déjà déconnecté : ne fait rien
  assert.equal(d.disconnects, 1);
});

// --- Coupure du Hub ---

test('coupure du Hub : statut déconnecté, reconnexion possible', async () => {
  const s = setup();
  await s.trainer.connect();
  const d = s.bluetooth.devices[0];
  d.fire('gattserverdisconnected');
  assert.equal(s.status.at(-1), 'disconnected');
  assert.equal(d.ch.count('characteristicvaluechanged'), 0);
  assert.equal(d.count('gattserverdisconnected'), 0);
  await s.trainer.connect(); // nouvel appareil
  assert.equal(s.bluetooth.requests, 2);
  s.bluetooth.devices[1].ch.send([0x41, 0, 0xC8, 0]);
  assert.equal(s.data.length, 1);
});

// --- Échecs ---

// Cas de la table du plan : étape en échec → nom de l'erreur, statuts, appareil.
const ECHecs = [
  { failures: { request: 'NotFoundError' }, nom: 'NotFoundError', statuts: ['searching', 'idle'], appareil: false },
  { failures: { gatt: 'NetworkError' }, nom: 'NetworkError', statuts: ['searching', 'connecting', 'idle'], appareil: true },
  { failures: { service: 'NotFoundError' }, nom: 'NotFoundError', statuts: ['searching', 'connecting', 'idle'], appareil: true },
  { failures: { notify: 'NetworkError' }, nom: 'NetworkError', statuts: ['searching', 'connecting', 'idle'], appareil: true },
];

test('échecs de connect()', async () => {
  for (const cas of ECHecs) {
    const s = setup(cas.failures);
    await assert.rejects(s.trainer.connect(), { name: cas.nom });
    assert.deepEqual(s.status, cas.statuts);
    if (cas.appareil) {
      const d = s.bluetooth.devices[0];
      assert.equal(d.disconnects, 1);
      assert.equal(d.count('gattserverdisconnected'), 0);
      assert.equal(d.ch.count('characteristicvaluechanged'), 0);
    } else {
      assert.deepEqual(s.bluetooth.devices, []); // pas d'appareil
    }
  }
});

test('nouvel essai après échec : reconnexion réussie', async () => {
  const f = { gatt: 'NetworkError' };
  const s = setup(f);
  await assert.rejects(s.trainer.connect());
  delete f.gatt; // le Hub répond désormais
  await s.trainer.connect();
  assert.equal(s.status.at(-1), 'connected');
  assert.equal(s.bluetooth.requests, 2);
});

// --- Sans Bluetooth ---

test('sans Bluetooth : NotSupportedError et aucun statut', async () => {
  const trainer = createFtmsTrainer({ bluetooth: undefined });
  const status = [];
  trainer.onStatus((s) => status.push(s));
  await assert.rejects(trainer.connect(), { name: 'NotSupportedError' });
  assert.deepEqual(status, []);
});
