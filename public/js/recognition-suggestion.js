const VALID_RANKS = new Set(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);

function normalizeRank(rank) {
  const normalized = String(rank || '').trim().toUpperCase();
  if (normalized === '1') return 'A';
  if (VALID_RANKS.has(normalized)) return normalized;
  return null;
}

export function buildRecognitionSuggestion({ playerRanks = [], dealerRank } = {}) {
  const playerCards = playerRanks.map(normalizeRank);
  const dealerCard = normalizeRank(dealerRank);

  if (playerCards.length === 0 || playerCards.some((rank) => !rank) || !dealerCard) {
    return null;
  }

  return {
    playerCards,
    dealerCard,
    summary: `Detected player ${playerCards.join(',')} vs dealer ${dealerCard}. Confirm to use this hand.`
  };
}

export function applyRecognitionSuggestion(state, suggestion) {
  if (!state || !suggestion) return state;
  state.playerCards = [...suggestion.playerCards];
  state.dealerCard = suggestion.dealerCard;
  return state;
}

export function autoApplyRecognitionSuggestion(state) {
  if (!state?.recognitionSuggestion) return false;
  const suggestion = state.recognitionSuggestion;
  applyRecognitionSuggestion(state, suggestion);
  state.recognitionSuggestion = null;
  state.autoRecognitionStatus = `Auto-filled player ${state.playerCards.join(',')} vs dealer ${state.dealerCard}.`;
  return true;
}
