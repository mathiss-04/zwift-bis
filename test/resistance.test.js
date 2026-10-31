// Tests du module de commande de résistance (étape 7).
// Toutes les valeurs attendues sont déjà calculées et vérifiées : on ne les recalcule pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DIFFICULTY,
  MAX_GRADE_PCT,
  clampDifficulty,
  gradeCommand,
  powerCommand,
  commandFor,
  sameCommand,
} from '../src/core/resistance.js';

test('constantes : DEFAULT_DIFFICULTY et MAX_GRADE_PCT', () => {
  assert.equal(DEFAULT_DIFFICULTY, 0.5);
  assert.equal(MAX_GRADE_PCT, 16);
});

test('clampDifficulty : bornage de la difficulté entre 0 et 1', () => {
  assert.equal(clampDifficulty(-1), 0);
  assert.equal(clampDifficulty(0.3), 0.3);
  assert.equal(clampDifficulty(1.5), 1);
});

// Pente × difficulté, bornée à ±16 %, arrondie à 0,01 %.
// `grade` est une fraction, `gradePct` est en pourcent.
const GRADE_ROWS = [
  { grade: 0.1, difficulty: 0.5, gradePct: 5 },
  { grade: 0.05, difficulty: 1, gradePct: 5 },
  { grade: 0.05, difficulty: 0, gradePct: 0 },
  { grade: 0.2, difficulty: 1, gradePct: 16 },
  { grade: 0.4, difficulty: 0.5, gradePct: 16 },
  { grade: 0.4, difficulty: 1, gradePct: 16 },
  { grade: -0.2, difficulty: 1, gradePct: -16 },
  { grade: -0.1, difficulty: 0.5, gradePct: -5 },
  { grade: 0.0333, difficulty: 0.5, gradePct: 1.67 },
  { grade: 0.07, difficulty: 0.33, gradePct: 2.31 },
  { grade: 0.1, difficulty: 1.5, gradePct: 10 },
  { grade: 0.1, difficulty: -1, gradePct: 0 },
  { grade: 0, difficulty: 0.5, gradePct: 0 },
  { grade: -0.001, difficulty: 0, gradePct: 0 },
];

test('gradeCommand : pente × difficulté, bornée à ±16 %', () => {
  for (const row of GRADE_ROWS) {
    assert.deepEqual(
      gradeCommand(row.grade, row.difficulty),
      { type: 'grade', gradePct: row.gradePct },
      `gradeCommand(${row.grade}, ${row.difficulty})`,
    );
  }
});

// Dernier cas de la table : une pente négative annulée par la difficulté
// doit donner 0, et surtout pas -0 (invisible avec ===, visible avec Object.is).
test('gradeCommand : pas de -0 en sortie', () => {
  const cmd = gradeCommand(-0.001, 0);
  assert.deepEqual(cmd, { type: 'grade', gradePct: 0 });
  assert.ok(Object.is(cmd.gradePct, 0), 'gradePct doit être 0, pas -0');
});

// Puissance cible : arrondie aux watts entiers, bornée en dessous à 0.
// Une cible de 0 W reste une cible.
const POWER_ROWS = [
  { watts: 200, expected: 200 },
  { watts: 199.6, expected: 200 },
  { watts: -5, expected: 0 },
  { watts: 0, expected: 0 },
];

test('powerCommand : watts arrondis, jamais négatifs', () => {
  for (const row of POWER_ROWS) {
    assert.deepEqual(
      powerCommand(row.watts),
      { type: 'power', watts: row.expected },
      `powerCommand(${row.watts})`,
    );
  }
});

// La 4ᵉ ligne a `targetW` absent (clé omise du state), comme pour un FreeRide.
const COMMAND_FOR_ROWS = [
  { args: { mode: 'free', grade: 0.1, difficulty: 0.5, targetW: 200 }, expected: { type: 'grade', gradePct: 5 } },
  { args: { mode: 'erg', grade: 0.1, difficulty: 0.5, targetW: 200 }, expected: { type: 'power', watts: 200 } },
  { args: { mode: 'erg', grade: 0.1, difficulty: 0.5, targetW: null }, expected: { type: 'grade', gradePct: 5 } },
  { args: { mode: 'erg', grade: 0.1, difficulty: 0.5 }, expected: { type: 'grade', gradePct: 5 } },
  { args: { mode: 'erg', grade: 0.1, difficulty: 0.5, targetW: 0 }, expected: { type: 'power', watts: 0 } },
];

test('commandFor : pente en sortie libre, puissance en erg, pente en FreeRide', () => {
  for (const row of COMMAND_FOR_ROWS) {
    assert.deepEqual(
      commandFor(row.args),
      row.expected,
      `commandFor mode=${row.args.mode}, targetW=${row.args.targetW}`,
    );
  }
});

const SAME_COMMAND_ROWS = [
  { a: { type: 'grade', gradePct: 5 }, b: { type: 'grade', gradePct: 5 }, expected: true },
  { a: { type: 'grade', gradePct: 5 }, b: { type: 'grade', gradePct: 6 }, expected: false },
  { a: { type: 'power', watts: 200 }, b: { type: 'power', watts: 200 }, expected: true },
  { a: { type: 'power', watts: 200 }, b: { type: 'power', watts: 201 }, expected: false },
  { a: { type: 'grade', gradePct: 5 }, b: { type: 'power', watts: 5 }, expected: false },
  { a: null, b: { type: 'power', watts: 5 }, expected: false },
  { a: { type: 'power', watts: 5 }, b: undefined, expected: false },
];

test('sameCommand : détection des consignes identiques', () => {
  for (const row of SAME_COMMAND_ROWS) {
    assert.equal(
      sameCommand(row.a, row.b),
      row.expected,
      `sameCommand(${JSON.stringify(row.a)}, ${JSON.stringify(row.b)})`,
    );
  }
});
