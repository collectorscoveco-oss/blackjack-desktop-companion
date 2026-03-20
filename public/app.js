const columns = ['Backlog', 'In Progress', 'Blocked', 'Complete'];
let boardState = null;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function setScoreRing(score) {
  const ring = document.getElementById('score-ring-inner');
  const scoreContainer = ring.parentElement;
  const degrees = Math.max(0, Math.min(360, (score / 100) * 360));
  ring.textContent = score;
  scoreContainer.style.background = `conic-gradient(#34d399 ${degrees}deg, rgba(255,255,255,0.08) ${degrees}deg)`;
}

function renderIssues(issues) {
  const list = document.getElementById('issues-list');
  list.innerHTML = '';
  if (!issues.length) {
    list.innerHTML = '<div class="issue-item"><strong>No issues found.</strong><p class="muted">Security audit came back clean.</p></div>';
    return;
  }
  const template = document.getElementById('issue-template');
  for (const issue of issues) {
    const node = template.content.cloneNode(true);
    node.querySelector('.severity').textContent = issue.severity;
    node.querySelector('.severity').classList.add(issue.severity);
    node.querySelector('.issue-title').textContent = issue.title;
    node.querySelector('.issue-detail').textContent = issue.detail || 'No additional detail provided.';
    node.querySelector('.issue-fix').textContent = issue.fix ? `Fix: ${issue.fix}` : '';
    list.appendChild(node);
  }
}

function renderOverview(overview) {
  const grid = document.getElementById('overview-grid');
  grid.innerHTML = '';
  const template = document.getElementById('card-template');
  Object.entries(overview).forEach(([key, value]) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.label').textContent = key;
    node.querySelector('strong').textContent = value;
    grid.appendChild(node);
  });
}

function collectBoardFromDom() {
  const board = {};
  document.querySelectorAll('.kanban-column').forEach((column) => {
    const name = column.dataset.column;
    board[name] = Array.from(column.querySelectorAll('.kanban-card')).map((card) => ({
      id: card.dataset.id,
      title: card.querySelector('.task-title').value,
      description: card.querySelector('.task-description').value
    }));
  });
  return board;
}

function createCard(task, columnIndex) {
  const template = document.getElementById('kanban-card-template');
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;
  node.querySelector('.task-title').value = task.title || '';
  node.querySelector('.task-description').value = task.description || '';
  node.querySelector('.move-left').onclick = () => moveCard(node, columnIndex - 1);
  node.querySelector('.move-right').onclick = () => moveCard(node, columnIndex + 1);
  node.querySelector('.delete-task').onclick = () => node.remove();
  node.addEventListener('dragstart', () => node.classList.add('dragging'));
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
  return node;
}

function moveCard(card, nextIndex) {
  if (nextIndex < 0 || nextIndex >= columns.length) return;
  const target = document.querySelector(`.kanban-column[data-column="${columns[nextIndex]}"] .kanban-cards`);
  target.appendChild(card);
}

function renderBoard(board) {
  boardState = board;
  const root = document.getElementById('kanban-board');
  root.innerHTML = '';
  const template = document.getElementById('kanban-column-template');
  columns.forEach((columnName, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.column = columnName;
    node.querySelector('h4').textContent = columnName;
    const cardsRoot = node.querySelector('.kanban-cards');
    cardsRoot.addEventListener('dragover', (event) => {
      event.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (dragging) cardsRoot.appendChild(dragging);
    });
    node.querySelector('.add-task').onclick = () => {
      const task = { id: crypto.randomUUID(), title: 'New task', description: 'Describe the task.' };
      cardsRoot.appendChild(createCard(task, index));
    };
    (board[columnName] || []).forEach((task) => cardsRoot.appendChild(createCard(task, index)));
    root.appendChild(node);
  });
}

async function refreshStatus() {
  const data = await fetchJson('/api/status');
  document.getElementById('status-pill').textContent = data.online ? 'Online' : 'Offline';
  document.getElementById('status-pill').className = `status-pill ${data.online ? 'online' : 'offline'}`;
  document.getElementById('host-name').textContent = data.system.hostname;
  document.getElementById('last-updated').textContent = new Date(data.generatedAt).toLocaleString();
  document.getElementById('security-score').textContent = `${data.security.score}/100`;
  setScoreRing(data.security.score);
  document.getElementById('cpu-load').textContent = data.system.cpuLoad.join(' / ');
  document.getElementById('memory-usage').textContent = `${data.system.memory.usedPercent}%`;
  document.getElementById('memory-detail').textContent = `${data.system.memory.usedGb}GB used of ${data.system.memory.totalGb}GB`;
  document.getElementById('disk-usage').textContent = data.system.disk.usedPercent == null ? 'N/A' : `${data.system.disk.usedPercent}%`;
  document.getElementById('disk-detail').textContent = data.system.disk.totalGb == null ? 'Disk stats unavailable' : `${data.system.disk.usedGb}GB used of ${data.system.disk.totalGb}GB`;
  document.getElementById('uptime').textContent = `${data.system.uptimeHours}h`;
  renderIssues(data.security.issues);
  renderOverview(data.openclaw.overview);
}

async function refreshBoard() {
  const board = await fetchJson('/api/kanban');
  renderBoard(board);
}

async function saveBoard() {
  const board = collectBoardFromDom();
  await fetchJson('/api/kanban', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board)
  });
}

document.getElementById('refresh-button').onclick = refreshStatus;
document.getElementById('save-board').onclick = async () => {
  await saveBoard();
  await refreshBoard();
};

Promise.all([refreshStatus(), refreshBoard()]).catch((error) => {
  console.error(error);
  document.getElementById('status-pill').textContent = 'Error';
  document.getElementById('status-pill').className = 'status-pill offline';
});
