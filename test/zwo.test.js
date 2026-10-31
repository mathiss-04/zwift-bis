// Tests du module de lecture des séances .zwo (étape 3).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, parseAttributes, tagText, parseZwo, totalDurationS } from '../src/core/zwo.js';

// Séance d'exemple : les six types de blocs, avec des entités XML,
// un commentaire, une balise non reconnue (textevent) et des guillemets simples.
const SAMPLE = `<?xml version="1.0"?>
<workout_file>
  <author>Test</author>
  <name>Séance &amp; test</name>
  <description>Six types de blocs</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.25" PowerHigh="0.75"/>
    <SteadyState Duration="300" Power="0.88" Cadence="90">
      <textevent timeoffset="10" message="Allez"/>
    </SteadyState>
    <!-- <SteadyState Duration="999" Power="9"/> -->
    <IntervalsT Repeat="2" OnDuration="30" OffDuration="60" OnPower="1.2" OffPower="0.5"/>
    <Ramp Duration="120" PowerLow="0.6" PowerHigh="1.0"/>
    <FreeRide Duration='180' FlatRoad="1"/>
    <Cooldown Duration="300" PowerLow="0.7" PowerHigh="0.3"/>
  </workout>
</workout_file>`;

test('decodeEntities : les cinq entités de base', () => {
  assert.equal(
    decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;'),
    'a & b <c> "d" \'e\'',
  );
});

test('decodeEntities : un seul passage, &amp;lt; donne &lt;', () => {
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
});

test('parseAttributes : guillemets doubles, simples et entités', () => {
  const attrs = parseAttributes(` Duration="600" FlatRoad='1' Name="a &amp; b"`);
  assert.deepEqual(attrs, { Duration: '600', FlatRoad: '1', Name: 'a & b' });
});

test('tagText : nom décodé et balise absente', () => {
  assert.equal(tagText(SAMPLE, 'name'), 'Séance & test');
  assert.equal(tagText(SAMPLE, 'absent'), '');
});

test('parseZwo : nom, description, nombre de blocs et durée totale', () => {
  const { name, description, blocks } = parseZwo(SAMPLE);
  assert.equal(name, 'Séance & test');
  assert.equal(description, 'Six types de blocs');
  assert.equal(blocks.length, 9);
  assert.equal(totalDurationS(blocks), 1680);
});

test('parseZwo : la liste complète des blocs', () => {
  const { blocks } = parseZwo(SAMPLE);
  assert.deepEqual(blocks, [
    { source: 'Warmup', type: 'ramp', durationS: 600, powerStart: 0.25, powerEnd: 0.75 },
    { source: 'SteadyState', type: 'steady', durationS: 300, powerStart: 0.88, powerEnd: 0.88 },
    { source: 'IntervalsT', type: 'steady', durationS: 30, powerStart: 1.2, powerEnd: 1.2 },
    { source: 'IntervalsT', type: 'steady', durationS: 60, powerStart: 0.5, powerEnd: 0.5 },
    { source: 'IntervalsT', type: 'steady', durationS: 30, powerStart: 1.2, powerEnd: 1.2 },
    { source: 'IntervalsT', type: 'steady', durationS: 60, powerStart: 0.5, powerEnd: 0.5 },
    { source: 'Ramp', type: 'ramp', durationS: 120, powerStart: 0.6, powerEnd: 1 },
    { source: 'FreeRide', type: 'free', durationS: 180, powerStart: null, powerEnd: null },
    { source: 'Cooldown', type: 'ramp', durationS: 300, powerStart: 0.7, powerEnd: 0.3 },
  ]);
});

test('parseZwo : SteadyState sans Power (repli sur PowerLow)', () => {
  const result = parseZwo('<workout><SteadyState Duration="60" PowerLow="0.5" PowerHigh="0.5"/></workout>');
  assert.equal(result.name, '');
  assert.equal(result.description, '');
  assert.deepEqual(result.blocks, [
    { source: 'SteadyState', type: 'steady', durationS: 60, powerStart: 0.5, powerEnd: 0.5 },
  ]);
});

test('parseZwo : balise <workout> absente', () => {
  assert.throws(
    () => parseZwo('<workout_file></workout_file>'),
    { message: '.zwo invalide : balise <workout> absente' },
  );
});

test('parseZwo : aucun bloc', () => {
  assert.throws(
    () => parseZwo('<workout></workout>'),
    { message: '.zwo invalide : aucun bloc' },
  );
});

test('parseZwo : SteadyState sans Duration valide', () => {
  assert.throws(
    () => parseZwo('<workout><SteadyState Power="0.5"/></workout>'),
    { message: '.zwo invalide : SteadyState sans Duration valide' },
  );
});

test('parseZwo : Ramp sans PowerLow valide', () => {
  assert.throws(
    () => parseZwo('<workout><Ramp Duration="60" PowerLow="x" PowerHigh="1"/></workout>'),
    { message: '.zwo invalide : Ramp sans PowerLow valide' },
  );
});
