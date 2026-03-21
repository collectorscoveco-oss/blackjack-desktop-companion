const CARD_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DEALER_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const STORAGE_KEY = 'blackjack-overlay-state-v2';
const INCOMPLETE_MESSAGE = 'Enter at least 2 player cards and 1 dealer upcard';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = Object.assign({
  playerCards: [],
  dealerCard: '',
  decks: 6,
  hitSoft17: true,
  doubleAfterSplit: true,
  surrenderAllowed: true,
  fastMode: false,
  trainingMode: false,
  chartVisible: false,
  history: []
}, loadState());

function cardValue(card) {
  if (card === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(card)) return 10;
  return Number(card);
}

function normalizeRank(card) {
  return ['K', 'Q', 'J'].includes(card) ? '10' : card;
}

function handInfo(cards) {
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

  return {
    total,
    soft,
    pair,
    blackjack,
    bust,
    normalized
  };
}

function upcardValue(card) {
  return card === 'A' ? 11 : Number(normalizeRank(card));
}

function classify(action) {
  if (['BUST', 'BLACKJACK'].includes(action)) return 'bad';
  if (action === 'SURRENDER') return 'bad';
  if (action === 'WAITING') return 'neutral';
  if (action.startsWith('DOUBLE') || action === 'SPLIT') return 'warn';
  return 'good';
}

function actionLabel(action) {
  return action
    .replace('DOUBLE/HIT', 'DOUBLE if allowed, otherwise HIT')
    .replace('DOUBLE/STAND', 'DOUBLE if allowed, otherwise STAND');
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
  if (rank === '9') {
    if ([2, 3, 4, 5, 6, 8, 9].includes(dealer)) return { action: 'SPLIT' };
    return { action: 'STAND' };
  }
  if (rank === '7') return { action: dealer >= 2 && dealer <= 7 ? 'SPLIT' : 'HIT' };
  if (rank === '6') {
    if (rules.doubleAfterSplit) return { action: dealer >= 2 && dealer <= 6 ? 'SPLIT' : 'HIT' };
    return { action: dealer >= 3 && dealer <= 6 ? 'SPLIT' : 'HIT' };
  }
  if (rank === '5') return { action: dealer >= 2 && dealer <= 9 ? 'DOUBLE/HIT' : 'HIT', alt: 'HIT' };
  if (rank === '4') {
    const ok = rules.doubleAfterSplit ? [5, 6].includes(dealer) : false;
    return { action: ok ? 'SPLIT' : 'HIT' };
  }
  if (rank === '3' || rank === '2') {
    if (rules.doubleAfterSplit) return { action: dealer >= 2 && dealer <= 7 ? 'SPLIT' : 'HIT' };
    return { action: dealer >= 4 && dealer <= 7 ? 'SPLIT' : 'HIT' };
  }
  return { action: 'HIT' };
}

function hasValidDecisionInput(cards, dealerCard) {
  return cards.length >= 2 && Boolean(dealerCard);
}

function waitingRecommendation(cards, dealerCard) {
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

function getRecommendation(cards, dealerCard, rules) {
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

  const displayAction = rec.action === 'DOUBLE/HIT' ? 'DOUBLE' : rec.action === 'DOUBLE/STAND' ? 'DOUBLE' : rec.action;
  const explanation = buildExplanation(info, dealerCard, rec, rules);

  return {
    action: rec.action,
    displayAction,
    tone: classify(rec.action),
    subtitle: actionLabel(rec.action),
    explanation,
    handLabel,
    detail: `${handLabel} vs dealer ${dealerCard}`,
    alt: rec.alt ? actionLabel(rec.alt) : ''
  };
}

function buildExplanation(info, dealerCard, rec, rules) {
  const shape = info.pair ? 'pair' : info.soft ? 'soft hand' : 'hard hand';
  const rulesText = [
    rules.hitSoft17 ? 'dealer hits soft 17' : 'dealer stands on soft 17',
    rules.doubleAfterSplit ? 'DAS on' : 'DAS off',
    rules.surrenderAllowed ? 'surrender on' : 'surrender off'
  ].join(', ');
  const base = `Basic strategy treats this as a ${shape} against dealer ${dealerCard}. Under ${rulesText}, the highest-EV line is ${actionLabel(rec.action).toLowerCase()}.`;
  return rec.alt ? `${base} If that option is unavailable, fall back to ${actionLabel(rec.alt).toLowerCase()}.` : base;
}

function chartMove(label) {
  const key = label.toUpperCase();
  if (key.startsWith('SPLIT')) return ['SPLIT', 'warn'];
  if (key.startsWith('DOUBLE')) return ['DOUBLE', 'warn'];
  if (key.startsWith('SUR')) return ['SURRENDER', 'bad'];
  if (key.startsWith('H')) return ['HIT', 'good'];
  return ['STAND', 'good'];
}

function generateChartRows(rules) {
  const rows = [];
  const hardTotals = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
  for (const total of hardTotals) {
    rows.push({ label: `Hard ${total}`, values: DEALER_ORDER.map((d) => actionLabel(hardStrategy(total, upcardValue(d), rules).action)) });
  }
  const softTotals = [20, 19, 18, 17, 16, 15, 14, 13];
  for (const total of softTotals) {
    rows.push({ label: `Soft ${total}`, values: DEALER_ORDER.map((d) => actionLabel(softStrategy(total, upcardValue(d), rules).action)) });
  }
  const pairRanks = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  for (const rank of pairRanks) {
    rows.push({ label: `Pair ${rank},${rank}`, values: DEALER_ORDER.map((d) => actionLabel(pairStrategy(rank, upcardValue(d), rules).action)) });
  }
  return rows;
}

function addCard(card) {
  state.playerCards.push(card);
  render();
}

function removeLastCard() {
  state.playerCards.pop();
  render();
}

function clearPlayerHand() {
  state.playerCards = [];
  render();
}

function startNewHand() {
  state.playerCards = [];
  state.dealerCard = '';
  render();
}

function setDealer(card) {
  state.dealerCard = card;
  render();
}

function toggle(key) {
  state[key] = !state[key];
  render();
}

function setDecks(value) {
  state.decks = Number(value) || 6;
  render();
}

function maybeRecordHand(rec) {
  if (!hasValidDecisionInput(state.playerCards, state.dealerCard)) return;
  if (['WAITING', 'BUST', 'BLACKJACK'].includes(rec.action)) return;
  const signature = `${state.playerCards.join(',')}|${state.dealerCard}|${rec.action}|${state.hitSoft17}|${state.doubleAfterSplit}|${state.surrenderAllowed}`;
  if (state.history[0]?.signature === signature) return;
  state.history.unshift({
    signature,
    player: state.playerCards.join(' '),
    dealer: state.dealerCard,
    hand: rec.handLabel,
    action: actionLabel(rec.action),
    when: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  state.history = state.history.slice(0, 5);
}

function cardButtons(active, onClick) {
  return CARD_ORDER.map((card) => `<button class="card-btn ${active === card ? 'active' : ''}" data-card="${card}" data-action="${onClick}">${card}</button>`).join('');
}

function handTextureLabel(info, hasDecision) {
  if (!hasDecision) return '—';
  if (info.blackjack) return 'Blackjack';
  if (info.bust) return 'Bust';
  if (info.pair) return 'Pair';
  return info.soft ? 'Soft' : 'Hard';
}

function render() {
  const rec = getRecommendation(state.playerCards, state.dealerCard, state);
  maybeRecordHand(rec);
  saveState(state);

  const app = document.getElementById('app');
  const info = handInfo(state.playerCards);
  const chartRows = generateChartRows(state);
  const hasDecision = hasValidDecisionInput(state.playerCards, state.dealerCard);

  app.innerHTML = `
    <div class="app-shell">
      <section class="topbar">
        <div class="title-wrap">
          <div class="eyebrow">Real-time blackjack helper</div>
          <h1>Blackjack Basic Strategy Overlay</h1>
          <p class="subtitle">Fast, local, distraction-free. No counting. No backend.</p>
        </div>
        <div class="top-actions">
          <button class="button secondary" data-action="toggle-fast">${state.fastMode ? 'Fast mode on' : 'Fast mode off'}</button>
          <button class="button secondary" data-action="toggle-training">${state.trainingMode ? 'Training on' : 'Training off'}</button>
          <button class="button secondary" data-action="toggle-chart">${state.chartVisible ? 'Hide chart' : 'Show chart'}</button>
          <button class="button ghost" data-action="new-hand">Start New Hand</button>
        </div>
      </section>

      <section class="result-card ${rec.tone}">
        <div class="result-label">Recommended move</div>
        <div class="result-action ${rec.tone}">${rec.displayAction}</div>
        <div class="result-subtext">${rec.detail}</div>
        <div class="tiny-copy">${rec.subtitle}${rec.alt ? ` · fallback: ${rec.alt}` : ''}</div>
        ${state.trainingMode ? `<div class="training-copy">${rec.explanation}</div>` : ''}
      </section>

      <div class="layout">
        <section class="panel card-grid">
          <div class="input-group">
            <div class="label-row">
              <label>Player hand</label>
              <div class="action-row">
                <button class="mini-btn" data-action="undo">Undo</button>
                <button class="mini-btn" data-action="clear-player">Clear</button>
              </div>
            </div>
            <div class="cards-display">
              ${state.playerCards.length ? state.playerCards.map((card) => `<span class="playing-card">${card}</span>`).join('') : '<span class="tiny-copy">Tap cards to build the hand.</span>'}
            </div>
            <div class="token-row">${cardButtons('', 'add-card')}</div>
          </div>

          <div class="input-group">
            <div class="label-row"><label>Dealer upcard</label><span class="tiny-copy">Select exactly one</span></div>
            <div class="token-row">${CARD_ORDER.map((card) => `<button class="card-btn ${state.dealerCard === card ? 'active' : ''}" data-card="${card}" data-action="dealer-card">${card}</button>`).join('')}</div>
          </div>

          <div class="inline-grid">
            <div class="input-group">
              <label class="section-label">Decks</label>
              <select id="decks-select">
                ${[1, 2, 4, 6, 8].map((n) => `<option value="${n}" ${state.decks === n ? 'selected' : ''}>${n} deck${n > 1 ? 's' : ''}</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label class="section-label">Hand type</label>
              <div class="help-copy">${hasDecision ? `${rec.handLabel}${state.playerCards.length > 2 && !['Blackjack'].includes(rec.handLabel) ? ' · multi-card hand' : ''}` : INCOMPLETE_MESSAGE}</div>
            </div>
          </div>

          <div class="toggle-row">
            <button class="toggle ${state.hitSoft17 ? 'active' : ''}" data-action="toggle-h17">Dealer hits soft 17</button>
            <button class="toggle ${!state.hitSoft17 ? 'active' : ''}" data-action="toggle-s17">Dealer stands soft 17</button>
            <button class="toggle ${state.doubleAfterSplit ? 'active' : ''}" data-action="toggle-das">Double after split</button>
            <button class="toggle ${state.surrenderAllowed ? 'active' : ''}" data-action="toggle-surrender">Surrender</button>
          </div>
        </section>

        <section class="card-grid">
          <section class="panel">
            <h2>Hand snapshot</h2>
            <div class="stats-grid">
              <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${hasDecision ? info.total : '—'}</div></div>
              <div class="stat"><div class="stat-label">Texture</div><div class="stat-value">${handTextureLabel(info, hasDecision)}</div></div>
              <div class="stat"><div class="stat-label">Dealer</div><div class="stat-value">${state.dealerCard || '—'}</div></div>
            </div>
            <p class="help-copy" style="margin-top:12px;">${hasDecision ? 'Color guide: green = standard best line, yellow = option-dependent / conditional, red = surrender or terminal state.' : INCOMPLETE_MESSAGE}</p>
          </section>

          <section class="panel history-card">
            <h2>Last 5 hands</h2>
            <div class="history-list">
              ${state.history.length ? state.history.map((item) => `<div class="history-item"><div><strong>${item.action}</strong><div class="history-meta">${item.hand} vs ${item.dealer} · ${item.player}</div></div><div class="history-meta">${item.when}</div></div>`).join('') : '<div class="history-meta">No hand history yet.</div>'}
            </div>
          </section>
        </section>
      </div>

      <section class="chart-card ${state.chartVisible ? '' : 'hidden'}">
        <h2 style="margin:0 0 8px 0;">Basic strategy chart</h2>
        <div class="chart-note">Chart updates with current rule toggles.</div>
        <table class="chart-table">
          <thead>
            <tr><th>Hand</th>${DEALER_ORDER.map((d) => `<th>${d}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${chartRows.map((row) => `<tr><td>${row.label}</td>${row.values.map((value) => {
              const [, tone] = chartMove(value);
              return `<td class="${tone}">${value.replaceAll(' if allowed, otherwise ', ' / ')}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div class="legend">
          <span><i class="dot green"></i>Best move</span>
          <span><i class="dot yellow"></i>Conditional / rule-dependent</span>
          <span><i class="dot red"></i>Surrender / risky state</span>
        </div>
      </section>
    </div>
  `;

  wireEvents();
}

function wireEvents() {
  document.querySelectorAll('[data-action="add-card"]').forEach((btn) => btn.onclick = () => addCard(btn.dataset.card));
  document.querySelectorAll('[data-action="dealer-card"]').forEach((btn) => btn.onclick = () => setDealer(btn.dataset.card));
  document.querySelectorAll('[data-action="undo"]').forEach((btn) => btn.onclick = removeLastCard);
  document.querySelectorAll('[data-action="clear-player"]').forEach((btn) => btn.onclick = clearPlayerHand);
  document.querySelectorAll('[data-action="new-hand"]').forEach((btn) => btn.onclick = startNewHand);
  document.querySelectorAll('[data-action="toggle-fast"]').forEach((btn) => btn.onclick = () => toggle('fastMode'));
  document.querySelectorAll('[data-action="toggle-training"]').forEach((btn) => btn.onclick = () => toggle('trainingMode'));
  document.querySelectorAll('[data-action="toggle-chart"]').forEach((btn) => btn.onclick = () => toggle('chartVisible'));
  document.querySelectorAll('[data-action="toggle-h17"]').forEach((btn) => btn.onclick = () => { state.hitSoft17 = true; render(); });
  document.querySelectorAll('[data-action="toggle-s17"]').forEach((btn) => btn.onclick = () => { state.hitSoft17 = false; render(); });
  document.querySelectorAll('[data-action="toggle-das"]').forEach((btn) => btn.onclick = () => toggle('doubleAfterSplit'));
  document.querySelectorAll('[data-action="toggle-surrender"]').forEach((btn) => btn.onclick = () => toggle('surrenderAllowed'));
  const decks = document.getElementById('decks-select');
  if (decks) decks.onchange = (e) => setDecks(e.target.value);
}

render();
