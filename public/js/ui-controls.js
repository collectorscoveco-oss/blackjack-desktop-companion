import {
  CARD_ORDER,
  DEALER_ORDER,
  INCOMPLETE_MESSAGE,
  actionLabel,
  generateChartRows,
  getRecommendation,
  handInfo,
  hasValidDecisionInput
} from './strategy-engine.js';

function chartTone(label) {
  const key = label.toUpperCase();
  if (key.startsWith('SPLIT')) return 'warn';
  if (key.startsWith('DOUBLE')) return 'warn';
  if (key.startsWith('SUR')) return 'bad';
  return 'good';
}

function textureLabel(info, ready) {
  if (!ready) return '—';
  if (info.blackjack) return 'Blackjack';
  if (info.bust) return 'Bust';
  if (info.pair) return 'Pair';
  return info.soft ? 'Soft' : 'Hard';
}

export function renderStrategyPane(root, state, onStateChange) {
  const rec = getRecommendation(state.playerCards, state.dealerCard, state.rules);
  const info = handInfo(state.playerCards);
  const ready = hasValidDecisionInput(state.playerCards, state.dealerCard);
  const chartRows = generateChartRows(state.rules);

  root.innerHTML = `
    <div class="strategy-shell">
      <div class="strategy-topbar">
        <div>
          <div class="eyebrow">Manual strategy assistant</div>
          <h2>Blackjack Basic Strategy</h2>
        </div>
        <div class="top-actions compact-wrap">
          <button class="ui-btn secondary" data-action="toggle-chart">${state.chartVisible ? 'Hide chart' : 'Chart'}</button>
          <button class="ui-btn secondary" data-action="toggle-training">${state.trainingMode ? 'Training on' : 'Training off'}</button>
          <button class="ui-btn ghost" data-action="new-hand">New Hand</button>
        </div>
      </div>

      <section class="result-card ${rec.tone}">
        <div class="result-label">Recommended move</div>
        <div class="result-action ${rec.tone}">${rec.displayAction}</div>
        <div class="result-subtext">${rec.detail}</div>
        <div class="tiny-copy">${rec.subtitle}${rec.alt ? ` · fallback: ${rec.alt}` : ''}</div>
        <div class="training-copy ${state.trainingMode ? '' : 'hidden'}">${rec.explanation}</div>
      </section>

      <section class="panel-section">
        <div class="label-row">
          <label>Player hand</label>
          <div class="inline-actions">
            <button class="mini-btn" data-action="undo">Undo</button>
            <button class="mini-btn" data-action="clear-player">Clear</button>
          </div>
        </div>
        <div class="cards-display">
          ${state.playerCards.length ? state.playerCards.map((card) => `<span class="playing-card">${card}</span>`).join('') : '<span class="tiny-copy">Tap cards to build the hand.</span>'}
        </div>
        <div class="token-row">
          ${CARD_ORDER.map((card) => `<button class="card-btn" data-action="add-card" data-card="${card}">${card}</button>`).join('')}
        </div>
      </section>

      <section class="panel-section">
        <div class="label-row"><label>Dealer upcard</label><span class="tiny-copy">Select exactly one</span></div>
        <div class="token-row">
          ${CARD_ORDER.map((card) => `<button class="card-btn ${state.dealerCard === card ? 'active' : ''}" data-action="dealer-card" data-card="${card}">${card}</button>`).join('')}
        </div>
      </section>

      <section class="panel-section stats-panel">
        <div class="two-col-grid">
          <div>
            <label>Decks</label>
            <select id="decks-select">
              ${[1, 2, 4, 6, 8].map((n) => `<option value="${n}" ${state.rules.decks === n ? 'selected' : ''}>${n} deck${n > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Hand type</label>
            <div class="help-copy">${ready ? rec.handLabel : INCOMPLETE_MESSAGE}</div>
          </div>
        </div>
        <div class="toggle-grid">
          <button class="toggle ${state.rules.hitSoft17 ? 'active' : ''}" data-action="hit-soft-17">Dealer hits soft 17</button>
          <button class="toggle ${!state.rules.hitSoft17 ? 'active' : ''}" data-action="stand-soft-17">Dealer stands soft 17</button>
          <button class="toggle ${state.rules.doubleAfterSplit ? 'active' : ''}" data-action="toggle-das">Double after split</button>
          <button class="toggle ${state.rules.surrenderAllowed ? 'active' : ''}" data-action="toggle-surrender">Surrender allowed</button>
        </div>
        <div class="stats-grid">
          <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${ready ? info.total : '—'}</div></div>
          <div class="stat"><div class="stat-label">Texture</div><div class="stat-value">${textureLabel(info, ready)}</div></div>
          <div class="stat"><div class="stat-label">Dealer</div><div class="stat-value">${state.dealerCard || '—'}</div></div>
        </div>
      </section>

      <section class="panel-section">
        <div class="label-row"><label>Last 5 hands</label><span class="tiny-copy">Session history</span></div>
        <div class="history-list">
          ${state.history.length ? state.history.map((item) => `<div class="history-item"><div><strong>${item.action}</strong><div class="history-meta">${item.hand} vs ${item.dealer} · ${item.player}</div></div><div class="history-meta">${item.when}</div></div>`).join('') : '<div class="history-meta">No hand history yet.</div>'}
        </div>
      </section>

      <section class="panel-section ${state.chartVisible ? '' : 'hidden'}">
        <div class="label-row"><label>Strategy chart</label><span class="tiny-copy">Testing / correctness view</span></div>
        <div class="chart-wrap">
          <table class="chart-table">
            <thead><tr><th>Hand</th>${DEALER_ORDER.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
            <tbody>
              ${chartRows.map((row) => `<tr><td>${row.label}</td>${row.values.map((value) => `<td class="${chartTone(value)}">${value.replaceAll(' if allowed, otherwise ', ' / ')}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  const maybeRecordHand = () => {
    if (!ready) return;
    if (['WAITING', 'BLACKJACK', 'BUST'].includes(rec.action)) return;
    const signature = `${state.playerCards.join(',')}|${state.dealerCard}|${rec.action}|${state.rules.hitSoft17}|${state.rules.doubleAfterSplit}|${state.rules.surrenderAllowed}`;
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
  };

  maybeRecordHand();

  root.querySelectorAll('[data-action="add-card"]').forEach((btn) => btn.addEventListener('click', () => {
    state.playerCards.push(btn.dataset.card);
    onStateChange();
  }));
  root.querySelectorAll('[data-action="dealer-card"]').forEach((btn) => btn.addEventListener('click', () => {
    state.dealerCard = btn.dataset.card;
    onStateChange();
  }));
  root.querySelector('[data-action="undo"]').addEventListener('click', () => {
    state.playerCards.pop();
    onStateChange();
  });
  root.querySelector('[data-action="clear-player"]').addEventListener('click', () => {
    state.playerCards = [];
    onStateChange();
  });
  root.querySelector('[data-action="new-hand"]').addEventListener('click', () => {
    state.playerCards = [];
    state.dealerCard = '';
    onStateChange();
  });
  root.querySelector('[data-action="toggle-chart"]').addEventListener('click', () => {
    state.chartVisible = !state.chartVisible;
    onStateChange();
  });
  root.querySelector('[data-action="toggle-training"]').addEventListener('click', () => {
    state.trainingMode = !state.trainingMode;
    onStateChange();
  });
  root.querySelector('[data-action="hit-soft-17"]').addEventListener('click', () => {
    state.rules.hitSoft17 = true;
    onStateChange();
  });
  root.querySelector('[data-action="stand-soft-17"]').addEventListener('click', () => {
    state.rules.hitSoft17 = false;
    onStateChange();
  });
  root.querySelector('[data-action="toggle-das"]').addEventListener('click', () => {
    state.rules.doubleAfterSplit = !state.rules.doubleAfterSplit;
    onStateChange();
  });
  root.querySelector('[data-action="toggle-surrender"]').addEventListener('click', () => {
    state.rules.surrenderAllowed = !state.rules.surrenderAllowed;
    onStateChange();
  });
  root.querySelector('#decks-select').addEventListener('change', (event) => {
    state.rules.decks = Number(event.target.value) || 6;
    onStateChange();
  });
}
