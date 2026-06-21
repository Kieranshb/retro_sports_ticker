const ENDPOINTS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  wc: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
};

const STATE_PRIORITY = { in: 0, pre: 1, post: 2 };
const DAYS_BACK = 2;
const DAYS_FORWARD = 0;

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWithinGameWindow(isoDate, ref = new Date()) {
  const gameDay = startOfLocalDay(new Date(isoDate));
  const earliest = startOfLocalDay(ref);
  earliest.setDate(earliest.getDate() - DAYS_BACK);
  const latest = startOfLocalDay(ref);
  latest.setDate(latest.getDate() + DAYS_FORWARD);
  return gameDay >= earliest && gameDay <= latest;
}

function dateKeysInWindow(ref = new Date()) {
  const keys = [];
  for (let offset = -DAYS_BACK; offset <= DAYS_FORWARD; offset++) {
    const d = new Date(ref);
    d.setDate(d.getDate() + offset);
    keys.push(todayDateKey(d));
  }
  return keys;
}

function todayDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function isSameLocalDay(isoDate, ref = new Date()) {
  const game = new Date(isoDate);
  return (
    game.getFullYear() === ref.getFullYear() &&
    game.getMonth() === ref.getMonth() &&
    game.getDate() === ref.getDate()
  );
}

function teamLogo(team) {
  const url = team.logo;
  const abbr = team.abbreviation || '?';
  if (!url) {
    return `<span class="team-abbr">${abbr}</span>`;
  }
  return `<img src="${url}" alt="" class="team-logo" crossorigin="anonymous" onerror="this.outerHTML='<span class=\\'team-abbr\\'>${abbr}</span>'">`;
}

function isLowContrastLogo(img) {
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || 32;
  const h = img.naturalHeight || 32;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  let visible = 0;
  let dark = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 64) continue;
    visible++;
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum < 110) dark++;
  }

  return visible > 0 && dark / visible > 0.35;
}

function applyLogoContrastHints() {
  document.querySelectorAll('.team-logo:not([data-contrast-checked])').forEach((img) => {
    const check = () => {
      img.dataset.contrastChecked = '1';
      try {
        if (isLowContrastLogo(img)) img.classList.add('low-contrast');
      } catch {
        img.classList.add('low-contrast');
      }
    };

    if (img.complete) check();
    else img.addEventListener('load', check, { once: true });
  });
}

function formatBases(situation) {
  if (!situation) return '';

  const { onFirst, onSecond, onThird } = situation;
  const base = (lit) => `<span class="base${lit ? ' lit' : ''}"></span>`;

  return `<span class="bases" aria-label="Runners on base">${base(onSecond)}<span class="base-row">${base(onThird)}${base(onFirst)}</span></span>`;
}

function formatEvent(league, event) {
  const comp = event.competitions[0];
  const c = comp.competitors;
  const home = c.find((t) => t.homeAway === 'home');
  const away = c.find((t) => t.homeAway === 'away');
  const status = event.status.type.shortDetail;
  const bases =
    league === 'mlb' && event.status.type.state === 'in' ? formatBases(comp.situation) : '';

  return `${league.toUpperCase()}: ${teamLogo(away.team)} ${away.score} - ${home.score} ${teamLogo(home.team)}${bases} (${status})`;
}

function eventSortKey(event) {
  const today = isSameLocalDay(event.date);
  const state = event.status.type.state;
  const stateRank = STATE_PRIORITY[state] ?? 3;
  return [today ? 0 : 1, stateRank, new Date(event.date).getTime()];
}

function compareEvents(a, b) {
  const ka = eventSortKey(a);
  const kb = eventSortKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  }
  return 0;
}

function mergeEvents(...eventGroups) {
  const byId = new Map();
  for (const events of eventGroups) {
    for (const event of events) {
      if (isWithinGameWindow(event.date)) {
        byId.set(event.id, event);
      }
    }
  }
  return [...byId.values()].sort(compareEvents);
}

async function fetchScoreboard(url, dates) {
  const query = dates ? `?dates=${dates}` : '';
  const res = await fetch(`${url}${query}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.events || [];
}

async function fetchLeagueEvents(url) {
  const dateKeys = dateKeysInWindow();
  const eventGroups = await Promise.all(dateKeys.map((key) => fetchScoreboard(url, key)));
  return mergeEvents(...eventGroups);
}

async function updateTicker() {
  const items = [];

  await Promise.all(
    Object.entries(ENDPOINTS).map(async ([league, url]) => {
      try {
        const events = await fetchLeagueEvents(url);
        for (const event of events) {
          items.push({ league, event });
        }
      } catch {
        // skip failed league
      }
    })
  );

  items.sort((a, b) => compareEvents(a.event, b.event));

  const ticker = document.getElementById('ticker');
  ticker.innerHTML = items.length
    ? items
        .map(({ league, event }) => `<span class="score-block">${formatEvent(league, event)}</span>`)
        .join('<span class="ticker-sep" aria-hidden="true"></span>')
    : 'NO GAMES IN RANGE';

  applyLogoContrastHints();
}

updateTicker();
setInterval(updateTicker, 60000);
