let allProjects = [];
let translations = {};
let filteredProjects = [];
let currentBoard = 'all';
let currentStatus = 'all';
let currentTag = 'all';
let currentSort = 'newest';
let currentLang = 'cn';
let searchQuery = '';
let showFavoritesOnly = false;
let favorites = new Set();

const STATUS_LABELS = { live: 'Live', dev: 'In Dev', closed: 'Closed' };
const BOARD_LABELS = { main: 'Main', programmer: 'Programmer', game: 'Game', archive: 'Archive' };

const CATEGORY_ICONS = {
  'AI/ML': '🤖', 'Developer': '💻', 'Productivity': '⚡', 'Game': '🎮',
  'Media': '🎬', 'Mobile': '📱', 'Web': '🌐', 'Finance': '💰',
  'Education': '📚', 'Design': '🎨', 'Other': '📦',
};

// --- LocalStorage ---

function loadFavorites() {
  try {
    const saved = localStorage.getItem('cid_favorites');
    if (saved) favorites = new Set(JSON.parse(saved));
  } catch { favorites = new Set(); }
}

function saveFavorites() {
  localStorage.setItem('cid_favorites', JSON.stringify([...favorites]));
}

function toggleFavorite(name, e) {
  if (e) e.stopPropagation();
  if (favorites.has(name)) favorites.delete(name);
  else favorites.add(name);
  saveFavorites();
  renderGrid();
}

// --- URL State ---

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('board')) currentBoard = params.get('board');
  if (params.has('status')) currentStatus = params.get('status');
  if (params.has('tag')) currentTag = params.get('tag');
  if (params.has('sort')) currentSort = params.get('sort');
  if (params.has('lang')) currentLang = params.get('lang');
  if (params.has('q')) searchQuery = params.get('q');
  if (params.has('fav')) showFavoritesOnly = params.get('fav') === '1';
}

function writeURLState() {
  const params = new URLSearchParams();
  if (currentBoard !== 'all') params.set('board', currentBoard);
  if (currentStatus !== 'all') params.set('status', currentStatus);
  if (currentTag !== 'all') params.set('tag', currentTag);
  if (currentSort !== 'newest') params.set('sort', currentSort);
  if (currentLang !== 'cn') params.set('lang', currentLang);
  if (searchQuery) params.set('q', searchQuery);
  if (showFavoritesOnly) params.set('fav', '1');

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

// --- Display Helpers ---

function getDisplayName(p) {
  if (currentLang === 'en' && translations[p.name]) return translations[p.name].en_name || p.name;
  return p.name;
}

function getDisplayDesc(p) {
  if (currentLang === 'en' && translations[p.name]) return translations[p.name].en_description || p.description;
  return p.description;
}

// --- Load Data ---

async function loadData() {
  try {
    const [projRes, transRes] = await Promise.all([
      fetch('data/projects.json'),
      fetch('data/translations.json').catch(() => null),
    ]);
    const data = await projRes.json();
    allProjects = data.projects;

    if (transRes && transRes.ok) {
      translations = await transRes.json();
    }

    document.getElementById('stats').textContent =
      `${data.totalProjects} projects | ${data.stats.live} live, ${data.stats.dev} in dev, ${data.stats.closed} closed`;

    buildCategoryButtons();
    readURLState();
    applyUIState();
    document.getElementById('loading').classList.add('hidden');
    applyFilters();
  } catch (err) {
    document.getElementById('loading').textContent = 'Failed to load data.';
  }
}

// --- Category Buttons ---

function buildCategoryButtons() {
  const cats = new Set();
  for (const p of allProjects) {
    if (p.tags) p.tags.forEach(t => cats.add(t));
  }

  const container = document.getElementById('category-filters');
  const sorted = [...cats].sort();
  container.innerHTML = `<button class="active" data-tag="all">All</button>` +
    sorted.map(c => `<button data-tag="${escHTML(c)}">${CATEGORY_ICONS[c] || ''} ${escHTML(c)}</button>`).join('');
}

// --- Apply UI State from URL ---

function applyUIState() {
  document.getElementById('search').value = searchQuery;

  document.querySelectorAll('#board-filters button').forEach(b => {
    b.classList.toggle('active', b.dataset.board === currentBoard);
  });
  document.querySelectorAll('#status-filters button').forEach(b => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
  });
  document.querySelectorAll('#category-filters button').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === currentTag);
  });
  document.getElementById('sort-select').value = currentSort;
  document.getElementById('lang-toggle').textContent = currentLang === 'en' ? 'CN' : 'EN';
  document.getElementById('favorites-toggle').classList.toggle('active', showFavoritesOnly);
}

// --- Filtering & Sorting ---

function applyFilters() {
  filteredProjects = allProjects.filter(p => {
    if (currentBoard !== 'all' && p.board !== currentBoard) return false;
    if (currentStatus !== 'all' && p.status !== currentStatus) return false;
    if (currentTag !== 'all' && !(p.tags && p.tags.includes(currentTag))) return false;
    if (showFavoritesOnly && !favorites.has(p.name)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = getDisplayName(p).toLowerCase();
      const desc = getDisplayDesc(p).toLowerCase();
      const author = (p.author.name || '').toLowerCase();
      if (!name.includes(q) && !desc.includes(q) && !author.includes(q)) return false;
    }
    return true;
  });

  sortProjects();
  writeURLState();
  renderGrid();
}

function sortProjects() {
  filteredProjects.sort((a, b) => {
    switch (currentSort) {
      case 'newest':
        return (b.date || '').localeCompare(a.date || '');
      case 'oldest':
        return (a.date || '').localeCompare(b.date || '');
      case 'name-asc':
        return getDisplayName(a).localeCompare(getDisplayName(b));
      case 'name-desc':
        return getDisplayName(b).localeCompare(getDisplayName(a));
      default:
        return 0;
    }
  });
}

// --- Rendering ---

function renderGrid() {
  const grid = document.getElementById('project-grid');
  const info = document.getElementById('results-info');

  info.textContent = `${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''} found`;

  if (filteredProjects.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:2rem;">No projects match your filters.</p>';
    return;
  }

  const initial = filteredProjects.slice(0, 60);
  const rest = filteredProjects.slice(60);

  grid.innerHTML = initial.map(cardHTML).join('');

  if (rest.length > 0) {
    const sentinel = document.createElement('div');
    sentinel.id = 'load-more';
    sentinel.style.gridColumn = '1/-1';
    sentinel.style.textAlign = 'center';
    sentinel.style.padding = '1rem';
    sentinel.style.color = '#888';
    sentinel.textContent = `Loading ${rest.length} more...`;
    grid.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        sentinel.remove();
        grid.insertAdjacentHTML('beforeend', rest.map(cardHTML).join(''));
        observer.disconnect();
      }
    });
    observer.observe(sentinel);
  }
}

function cardHTML(p) {
  const displayName = getDisplayName(p);
  const displayDesc = getDisplayDesc(p);
  const isFav = favorites.has(p.name);
  const nameLink = p.url
    ? `<a href="${escHTML(p.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${escHTML(displayName)}</a>`
    : escHTML(displayName);

  const desc = displayDesc || 'No description';
  const authorText = p.author.name || 'Unknown';
  const dateText = p.date || '';
  const tags = (p.tags || []).map(t =>
    `<span class="tag-pill">${CATEGORY_ICONS[t] || ''} ${escHTML(t)}</span>`
  ).join(' ');

  return `
    <div class="card" onclick="showDetail(${JSON.stringify(p).replace(/"/g, '&quot;').replace(/'/g, '&#39;')})">
      <div class="card-header">
        <span class="card-name">${nameLink}</span>
        <span class="status-badge status-${p.status}">${STATUS_LABELS[p.status] || p.status}</span>
      </div>
      <div class="card-desc">${escHTML(desc)}</div>
      <div class="card-tags">${tags}</div>
      <div class="card-meta">
        <span class="card-author">${escHTML(authorText)}${p.author.city ? ' (' + escHTML(p.author.city) + ')' : ''}</span>
        <span class="card-actions">
          <span class="card-board">${BOARD_LABELS[p.board] || p.board}</span>
          <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${escHTML(p.name).replace(/'/g, "\\'")}', event)" title="Toggle favorite">★</button>
        </span>
      </div>
    </div>
  `;
}

function escHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Detail Modal ---

function showDetail(p) {
  const content = document.getElementById('modal-content');
  const displayName = getDisplayName(p);
  const displayDesc = getDisplayDesc(p);

  const nameLink = p.url
    ? `<a href="${escHTML(p.url)}" target="_blank" rel="noopener">${escHTML(displayName)}</a>`
    : escHTML(displayName);

  let html = `
    <h2>${nameLink}</h2>
    <div class="modal-status">
      <span class="status-badge status-${p.status}">${STATUS_LABELS[p.status] || p.status}</span>
      <span class="card-board" style="margin-left:0.5rem">${BOARD_LABELS[p.board] || p.board}</span>
    </div>
    <div class="modal-desc">${escHTML(displayDesc || 'No description')}</div>
    <div class="modal-info">
      <p><strong>Author:</strong> ${escHTML(p.author.name || 'Unknown')}${p.author.city ? ' (' + escHTML(p.author.city) + ')' : ''}</p>
  `;

  if (p.author.github) {
    html += `<p><strong>GitHub:</strong> <a href="${escHTML(p.author.github)}" target="_blank" rel="noopener">${escHTML(p.author.github)}</a></p>`;
  }
  if (p.author.blog) {
    html += `<p><strong>Blog:</strong> <a href="${escHTML(p.author.blog)}" target="_blank" rel="noopener">${escHTML(p.author.blog)}</a></p>`;
  }
  if (p.moreInfoUrl) {
    html += `<p><strong>${escHTML(p.moreInfoLabel || 'More info')}:</strong> <a href="${escHTML(p.moreInfoUrl)}" target="_blank" rel="noopener">${escHTML(p.moreInfoUrl)}</a></p>`;
  }
  if (p.date) {
    html += `<p><strong>Date added:</strong> ${escHTML(p.date)}</p>`;
  }
  if (p.tags && p.tags.length > 0) {
    html += `<p><strong>Tags:</strong> ${p.tags.map(t => escHTML(t)).join(', ')}</p>`;
  }

  html += '</div>';
  content.innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// --- Random Pick ---

function pickRandom() {
  if (filteredProjects.length === 0) {
    alert('No projects to pick from.');
    return;
  }
  const idx = Math.floor(Math.random() * filteredProjects.length);
  const p = filteredProjects[idx];

  const cards = document.querySelectorAll('.card');
  cards.forEach(c => c.classList.remove('highlighted'));

  const targetName = p.name;
  const allCards = document.querySelectorAll('.card');
  for (const card of allCards) {
    if (card.onclick && card.onclick.toString().includes(targetName)) {
      card.classList.add('highlighted');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
  }

  showDetail(p);
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
  loadFavorites();
  loadData();

  // Search
  let debounce;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = e.target.value.trim();
      applyFilters();
    }, 200);
  });

  // Board filters
  document.getElementById('board-filters').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    currentBoard = e.target.dataset.board;
    document.querySelectorAll('#board-filters button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    applyFilters();
  });

  // Status filters
  document.getElementById('status-filters').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    currentStatus = e.target.dataset.status;
    document.querySelectorAll('#status-filters button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    applyFilters();
  });

  // Category filters (delegated)
  document.getElementById('category-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    currentTag = btn.dataset.tag;
    document.querySelectorAll('#category-filters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilters();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFilters();
  });

  // Language toggle
  document.getElementById('lang-toggle').addEventListener('click', () => {
    currentLang = currentLang === 'cn' ? 'en' : 'cn';
    document.getElementById('lang-toggle').textContent = currentLang === 'en' ? 'CN' : 'EN';
    applyFilters();
  });

  // Random
  document.getElementById('random-btn').addEventListener('click', pickRandom);

  // Favorites toggle
  document.getElementById('favorites-toggle').addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly;
    document.getElementById('favorites-toggle').classList.toggle('active', showFavoritesOnly);
    applyFilters();
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});
