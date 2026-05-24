import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function loadStrategyEngine() {
  const source = readFileSync(new URL('../public/js/strategy-engine.js', import.meta.url), 'utf8')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ')
    .replace(/\nexport \{[^}]+\};?\s*$/m, '');

  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nObject.assign(globalThis, { CARD_ORDER, DEALER_ORDER, defaultRules, handInfo, getRecommendation, generateChartRows });`, context);
  return context;
}

const engine = loadStrategyEngine();

test('manual basic strategy recommends split for pair of aces', () => {
  const rec = engine.getRecommendation(['A', 'A'], '6', engine.defaultRules);
  assert.equal(rec.displayAction, 'SPLIT');
  assert.equal(rec.handLabel, 'Pair of As');
});

test('manual basic strategy recommends double for hard 11 against dealer 10', () => {
  const rec = engine.getRecommendation(['6', '5'], '10', engine.defaultRules);
  assert.equal(rec.displayAction, 'DOUBLE');
  assert.equal(rec.subtitle, 'DOUBLE if allowed, otherwise HIT');
});

test('manual basic strategy respects surrender toggle for hard 16 against dealer ace', () => {
  const withSurrender = engine.getRecommendation(['10', '6'], 'A', { ...engine.defaultRules, surrenderAllowed: true });
  const withoutSurrender = engine.getRecommendation(['10', '6'], 'A', { ...engine.defaultRules, surrenderAllowed: false });

  assert.equal(withSurrender.displayAction, 'SURRENDER');
  assert.equal(withoutSurrender.displayAction, 'HIT');
});

test('chart rows include hard, soft, and pair sections for visible chart mode', () => {
  const labels = engine.generateChartRows(engine.defaultRules).map((row) => row.label);
  assert.ok(labels.includes('Hard 16'));
  assert.ok(labels.includes('Soft 18'));
  assert.ok(labels.includes('Pair A,A'));
});
