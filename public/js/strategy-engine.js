export const CARD_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const DEALER_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
export const INCOMPLETE_MESSAGE = 'Enter at least 2 player cards and 1 dealer upcard';

export const defaultRules = {
  decks: 6,
  hitSoft17: true,
  doubleAfterSplit: true,
  surrenderAllowed: true
};

export function cardValue(card) {
  if (card === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(card)) return 10;
  return Number(card);
}

export function normalizeRank(card) {
  return ['K', 'Q', 'J'].includes(card) ? '10' : card;
}

export function handInfo(cards) {
  const normalized = cards.map(normalizeRank);
  let total = 0;
  let aceCount = 0;

  for (const card of cards) {
    total += cardValue(card);
    if (card === 'A') aceCount += 1;
  }

  let acesCountedAsEleven = aceCount;
  while (total > 21 && acesCountedAsEleven > 0) {
    total -= 10;
    acesCountedAsEleven -= 1;
  }

  const soft = total <= 21 && acesCountedAsEleven > 0;
  const pair = cards.length === 2 && normalized[0] === normalized[1];
  const blackjack = cards.length === 2 && total === 21 && normalized.includes('A') && normalized.includes('10');
  const bust = total > 21;

  return { total, soft, pair, blackjack, bust, normalized };
}

export function upcardValue(card) {
  return card === 'A' ? 11 : Number(normalizeRank(card));
}

export function actionLabel(action) {
  return action
    .replace('DOUBLE/HIT', 'DOUBLE if allowed, otherwise HIT')
    .replace('DOUBLE/STAND', 'DOUBLE if allowed, otherwise STAND');
}

function classify(action) {
  if (action === 'WAITING') return 'neutral';
  if (action === 'SURRENDER') return 'bad';
  if (action.startsWith('DOUBLE') || action === 'SPLIT') return 'warn';
  return 'good';
}

function hardStrategy(total, dealer, rules) {
  if (rules.surrenderAllowed) {
    if (total === 16 && [9, 10, 11].includes(dealer)) return { action: 'SURRENDER', alt: 'HIT' };
    if (total === 15 && dealer === 10) return { action: 'SURRENDER', alt: 'HIT' };
  }
  if (total >= 17) return { action: 'STAND' };
  if (total >= 13 && total <= 16) return { action: dealer >= 2 && dealer <= 6 ? 'STAND' : 'HIT' };
  if (total === 12) return { action: dealer >= 4 && dealer <= 6 ? 'STAND' : 'HIT' };
  if (total === 11) return { action: 'DOUBLE/HIT' };
  if (total === 10) return { action: dealer >= 2 && dealer <= 9 ? 'DOUBLE/HIT' : 'HIT' };
  if (total === 9) return { action: dealer >= 3 && dealer <= 6 ? 'DOUBLE/HIT' : 'HIT' };
  return { action: 'HIT' };
}

function softStrategy(total, dealer, rules) {
  if (total >= 20) return { action: 'STAND' };
  if (total === 19) {
    if (!rules.hitSoft17 && dealer === 6) return { action: 'DOUBLE/STAND', alt: 'STAND' };
    return { action: 'STAND' };
  }
  if (total === 18) {
    if (dealer >= 3 && dealer <= 6) return { action: 'DOUBLE/STAND', alt: 'STAND' };
    if (dealer === 2 || dealer === 7 || dealer === 8) return { action: 'STAND' };
    return { action: 'HIT' };
  }
  if (total === 17) return { action: dealer >= 3 && dealer <= 6 ? 'DOUBLE/HIT' : 'HIT' };
  if (total === 16 || total === 15) return { action: dealer >= 4 && dealer <= 6 ? 'DOUBLE/HIT' : 'HIT' };
  if (total === 14 || total === 13) return { action: dealer >= 5 && dealer <= 6 ? 'DOUBLE/HIT' : 'HIT' };
  return { action: 'HIT' };
}

function pairStrategy(rank, dealer, rules) {
  if (rank === 'A' || rank === '8') return { action: 'SPLIT' };
  if (rank === '10') return { action: 'STAND' };
  if (rank === '9') return [2, 3, 4, 5, 6, 8, 9].includes(dealer) ? { action: 'SPLIT' } : { action: 'STAND' };
  if (rank === '7') return { action: dealer >= 2 && dealer <= 7 ? 'SPLIT' : 'HIT' };
  if (rank === '6') {
    if (rules.doubleAfterSplit) return { action: dealer >= 2 && dealer <= 6 ? 'SPLIT' : 'HIT' };
    return { action: dealer >= 3 && dealer <= 6 ? 'SPLIT' : 'HIT' };
  }
  if (rank === '5') return { action: dealer >= 2 && dealer <= 9 ? 'DOUBLE/HIT' : 'HIT', alt: 'HIT' };
  if (rank === '4') return { action: rules.doubleAfterSplit && [5, 6].includes(dealer) ? 'SPLIT' : 'HIT' };
  if (rank === '3' || rank === '2') {
    if (rules.doubleAfterSplit) return { action: dealer >= 2 && dealer <= 7 ? 'SPLIT' : 'HIT' };
    return { action: dealer >= 4 && dealer <= 7 ? 'SPLIT' : 'HIT' };
  }
  return { action: 'HIT' };
}

export function hasValidDecisionInput(cards, dealerCard) {
  return cards.length >= 2 && Boolean(dealerCard);
}

export function buildExplanation(info, dealerCard, rec, rules) {
  const shape = info.pair ? 'pair' : info.soft ? 'soft hand' : 'hard hand';
  const rulesText = [
    rules.hitSoft17 ? 'dealer hits soft 17' : 'dealer stands on soft 17',
    rules.doubleAfterSplit ? 'DAS on' : 'DAS off',
    rules.surrenderAllowed ? 'surrender on' : 'surrender off'
  ].join(', ');
  const base = `Basic strategy treats this as a ${shape} against dealer ${dealerCard}. Under ${rulesText}, the highest-EV line is ${actionLabel(rec.action).toLowerCase()}.`;
  return rec.alt ? `${base} If that option is unavailable, fall back to ${actionLabel(rec.alt).toLowerCase()}.` : base;
}

export function waitingRecommendation(cards, dealerCard) {
  const detail = cards.length || dealerCard ? INCOMPLETE_MESSAGE : 'Waiting for input.';
  return {
    action: 'WAITING',
    displayAction: '—',
    tone: 'neutral',
    subtitle: INCOMPLETE_MESSAGE,
    explanation: 'Basic strategy only applies after you enter at least two player cards and one dealer upcard.',
    handLabel: 'Incomplete hand',
    detail,
    alt: ''
  };
}

export function getRecommendation(cards, dealerCard, rules = defaultRules) {
  if (!hasValidDecisionInput(cards, dealerCard)) return waitingRecommendation(cards, dealerCard);

  const info = handInfo(cards);
  const dealer = upcardValue(dealerCard);

  if (info.bust) {
    return {
      action: 'BUST',
      displayAction: 'BUST',
      tone: 'bad',
      subtitle: 'Hand is over 21.',
      explanation: 'No strategy decision applies once the hand is already bust.',
      handLabel: `Bust ${info.total}`,
      detail: 'Hand is busted. Start a new hand.',
      alt: ''
    };
  }

  if (info.blackjack) {
    return {
      action: 'BLACKJACK',
      displayAction: 'BLACKJACK',
      tone: 'good',
      subtitle: 'Natural blackjack detected.',
      explanation: 'A two-card 21 is a completed hand, not a strategy decision state.',
      handLabel: 'Blackjack',
      detail: `Blackjack vs dealer ${dealerCard}`,
      alt: ''
    };
  }

  let rec;
  let handLabel = `Hard ${info.total}`;

  if (info.pair) {
    handLabel = `Pair of ${info.normalized[0]}s`;
    rec = pairStrategy(info.normalized[0], dealer, rules);
  } else if (info.soft) {
    handLabel = `Soft ${info.total}`;
    rec = softStrategy(info.total, dealer, rules);
  } else {
    rec = hardStrategy(info.total, dealer, rules);
  }

  return {
    action: rec.action,
    displayAction: rec.action === 'DOUBLE/HIT' || rec.action === 'DOUBLE/STAND' ? 'DOUBLE' : rec.action,
    tone: classify(rec.action),
    subtitle: actionLabel(rec.action),
    explanation: buildExplanation(info, dealerCard, rec, rules),
    handLabel,
    detail: `${handLabel} vs dealer ${dealerCard}`,
    alt: rec.alt ? actionLabel(rec.alt) : ''
  };
}

export function generateChartRows(rules = defaultRules) {
  const rows = [];
  for (const total of [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5]) {
    rows.push({ label: `Hard ${total}`, values: DEALER_ORDER.map((d) => actionLabel(hardStrategy(total, upcardValue(d), rules).action)) });
  }
  for (const total of [20, 19, 18, 17, 16, 15, 14, 13]) {
    rows.push({ label: `Soft ${total}`, values: DEALER_ORDER.map((d) => actionLabel(softStrategy(total, upcardValue(d), rules).action)) });
  }
  for (const rank of ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2']) {
    rows.push({ label: `Pair ${rank},${rank}`, values: DEALER_ORDER.map((d) => actionLabel(pairStrategy(rank, upcardValue(d), rules).action)) });
  }
  return rows;
}
