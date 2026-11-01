// Tests de l'étape 11 pour src/ui/pairing.js.
// Faux éléments de l'interface et faux entraîneur, recopiés tels quels du plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FRAMES, statusText, describeError, createPairing } from '../src/ui/pairing.js';

function setup({ onConnect = async () => {}, onError = async () => {} } = {}) {
  const elements = {
    connect: { disabled: false, click: null, addEventListener(t, f) { if (t === 'click') this.click = f; } },
    status: { textContent: '' },
    frames: { textContent: '' },
  };
  const trainer = { onStatus(c) { this.status = c; }, onRaw(c) { this.raw = c; } };
  createPairing({ elements, trainer, onConnect, onError });
  return { elements, trainer };
}
// Crée une erreur portant le `name` donné (celui que Web Bluetooth utilise).
const named = (name, message = 'x') => Object.assign(new Error(message), { name });

test('la constante MAX_FRAMES vaut 8', () => {
  assert.equal(MAX_FRAMES, 8);
});

// Les 5 lignes du tableau du plan, recopiées telles quelles.
test('statusText traduit les cinq statuts', () => {
  assert.equal(statusText('idle'), 'Hub non connecté');
  assert.equal(statusText('searching'), 'Choisis ton Hub dans la fenêtre du navigateur');
  assert.equal(statusText('connecting'), 'Connexion au Hub…');
  assert.equal(statusText('connected'), 'Hub connecté');
  assert.equal(statusText('disconnected'), 'Hub déconnecté');
});

test('describeError : NotFoundError contient Zwift', () => {
  assert.ok(describeError(named('NotFoundError')).includes('Zwift'));
});

test('describeError : NetworkError contient Zwift', () => {
  assert.ok(describeError(named('NetworkError')).includes('Zwift'));
});

test('describeError : SecurityError contient HTTPS', () => {
  assert.ok(describeError(named('SecurityError')).includes('HTTPS'));
});

test('describeError : NotSupportedError contient Chrome ou Edge', () => {
  assert.ok(describeError(named('NotSupportedError')).includes('Chrome ou Edge'));
});

test('describeError : toute autre erreur renvoie le message', () => {
  assert.equal(describeError(named('AbortError', 'coupé')), 'Erreur Bluetooth : coupé');
});

test('statut : affichage initial et mise à jour du bouton', () => {
  const { elements, trainer } = setup();
  // Au départ, le statut affiche le texte de l'état repos.
  assert.equal(elements.status.textContent, 'Hub non connecté');
  // À chaque statut, le texte suit statusText et le bouton se verrouille pendant la connexion.
  for (const [s, disabled] of [
    ['searching', true],
    ['connecting', true],
    ['connected', true],
    ['disconnected', false],
    ['idle', false],
  ]) {
    trainer.status(s);
    assert.equal(elements.status.textContent, statusText(s));
    assert.equal(elements.connect.disabled, disabled);
  }
});

test('trames : les plus récentes d\'abord, plafonnées à 8 lignes', () => {
  const { elements, trainer } = setup();
  trainer.raw('A');
  trainer.raw('B');
  assert.equal(elements.frames.textContent, 'B\nA');
  // Dix appels : seules les 8 trames les plus récentes restent affichées.
  for (let i = 0; i < 10; i++) trainer.raw(`F${i}`);
  const lines = elements.frames.textContent.split('\n');
  assert.equal(lines.length, 8);
  assert.equal(lines[0], 'F9');
  assert.equal(lines[lines.length - 1], 'F2');
});

test('clic réussi : onConnect appelé une fois, onError jamais', async () => {
  let connectCalls = 0;
  let errorCalls = 0;
  const { elements } = setup({
    onConnect: async () => { connectCalls++; },
    onError: async () => { errorCalls++; },
  });
  await elements.connect.click();
  assert.equal(connectCalls, 1);
  assert.equal(errorCalls, 0);
});

test('clic en échec : onError appelé, bouton réactivé, message d\'erreur affiché', async () => {
  let errorCalls = 0;
  let button; // assigné juste après setup, avant que le clic ne soit possible.
  const { elements } = setup({
    onConnect: async () => { button.disabled = true; throw named('NetworkError'); },
    onError: async () => { errorCalls++; },
  });
  button = elements.connect;
  await elements.connect.click();
  assert.equal(errorCalls, 1);
  assert.equal(elements.connect.disabled, false);
  assert.equal(elements.status.textContent, describeError(named('NetworkError')));
});
