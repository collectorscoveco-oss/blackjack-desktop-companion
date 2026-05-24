import assert from 'node:assert/strict';
import { test } from 'node:test';

const moduleUrl = new URL('../public/js/recognition-suggestion.js', import.meta.url);
const { buildRecognitionSuggestion, applyRecognitionSuggestion, autoApplyRecognitionSuggestion } = await import(moduleUrl.href + `?case=${Date.now()}`);

test('recognition suggestion normalizes card ranks for manual confirmation', () => {
  const suggestion = buildRecognitionSuggestion({ playerRanks: [' j ', '6'], dealerRank: '7' });

  assert.deepEqual(suggestion.playerCards, ['J', '6']);
  assert.equal(suggestion.dealerCard, '7');
  assert.equal(suggestion.summary, 'Detected player J,6 vs dealer 7. Confirm to use this hand.');
});

test('recognition suggestion rejects unknown ranks instead of changing the hand', () => {
  assert.equal(buildRecognitionSuggestion({ playerRanks: ['J', '?'], dealerRank: '7' }), null);
  assert.equal(buildRecognitionSuggestion({ playerRanks: ['J', '6'], dealerRank: 'joker' }), null);
});

test('accepted recognition suggestion fills the manual assistant hand', () => {
  const state = { playerCards: ['2'], dealerCard: 'A' };
  const suggestion = buildRecognitionSuggestion({ playerRanks: ['J', '6'], dealerRank: '7' });

  applyRecognitionSuggestion(state, suggestion);

  assert.deepEqual(state.playerCards, ['J', '6']);
  assert.equal(state.dealerCard, '7');
});

test('confident auto recognition directly fills and clears the manual assistant state', () => {
  const state = {
    playerCards: ['2'],
    dealerCard: 'A',
    recognitionSuggestion: buildRecognitionSuggestion({ playerRanks: ['10', '5'], dealerRank: '9' })
  };

  const applied = autoApplyRecognitionSuggestion(state);

  assert.equal(applied, true);
  assert.deepEqual(state.playerCards, ['10', '5']);
  assert.equal(state.dealerCard, '9');
  assert.equal(state.recognitionSuggestion, null);
  assert.equal(state.autoRecognitionStatus, 'Auto-filled player 10,5 vs dealer 9.');
});
