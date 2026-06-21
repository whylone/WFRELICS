// Сборщик данных для WFRELICS.
// ИСТОЧНИК ИСТИНЫ — официальный droptable Digital Extremes (warframe.com/droptables).
// Это тот же источник, что у вики: он обновляется в день патча, поэтому новые
// праймы и ротации волта появляются на сайте сразу, без задержки community-зеркал.
//
// Из droptable берём: содержимое реликвий, шансы по рефайнам, ранги наград,
// доступность (реликвия доступна, если реально падает в миссии/бонусе) и все локации.
// warframestat нужен только для категории оружия (Primary/Secondary/Melee/...),
// и используется как best-effort обогащение с кэшем — если упадёт, сборка не ломается.
//
// Запуск:  node tools/build-data.mjs
// Требуется Node 18+ (глобальный fetch).

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data');
const OUT_FILE = join(OUT_DIR, 'primes.json');
// Коммитимый запас категорий: последняя известная категория каждого предмета.
// Нужен, если warframestat недоступен в момент сборки (в CI локального кэша нет).
const CAT_FILE = join(OUT_DIR, 'categories.json');
const CACHE_DIR = join(__dirname, '..', '.cache');
const HTML_CACHE = join(CACHE_DIR, 'droptable.html');
const ITEMS_CACHE = join(CACHE_DIR, 'items.json');

const DROPTABLE_URL = 'https://www.warframe.com/droptables';
const ITEMS_URL = 'https://api.warframestat.us/items/?language=en&only=name,isPrime,category,productCategory';

const STATES = ['Intact', 'Exceptional', 'Flawless', 'Radiant'];
const CDN = 'https://cdn.warframestat.us/img/';

// Источники, не нужные в планировщике фарма: PvP и ограниченные по времени ивенты.
const EXCLUDE_LOCATION = /faceoff|conclave|lunaro|plague star|ghoul|hemocyte/i;

// --- сетевой слой: retry + экспоненциальный backoff + fallback на кэш ---
async function fetchWithRetry(url, { json, cacheFile, maxRetries = 3 } = {}) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'WFRELICS-builder' }, redirect: 'follow' });
      if (!res.ok) {
        if (res.status >= 500 && attempt < maxRetries - 1) {
          const delay = 2 ** attempt * 1000;
          console.log(`⚠ HTTP ${res.status}, повтор через ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`${url} -> HTTP ${res.status}`);
      }
      const text = await res.text();
      if (cacheFile) {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(cacheFile, text);
      }
      return json ? JSON.parse(text) : text;
    } catch (err) {
      if (attempt === maxRetries - 1) {
        if (cacheFile) {
          try {
            console.log(`⚠ Все попытки не удались. Беру кэш ${cacheFile}...`);
            const text = await readFile(cacheFile, 'utf8');
            return json ? JSON.parse(text) : text;
          } catch { /* кэша нет — пробрасываем исходную ошибку */ }
        }
        throw err;
      }
      const delay = 2 ** attempt * 1000;
      console.log(`⚠ Ошибка: ${err.message}, повтор через ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// --- разбор предмета/прайма ---
// owner: "Akbronco Prime Link" -> "Akbronco Prime"; "Dual Zoren Prime Blade" -> "Dual Zoren Prime"
function ownerOf(name) {
  const i = name.indexOf(' Prime');
  if (i < 0) return null;
  return name.slice(0, i + ' Prime'.length);
}
function shortPart(name, owner) {
  const rest = name.slice(owner.length).trim();
  return rest === '' ? 'Set' : rest;
}
const FRAME_PART = /^(Neuroptics|Chassis|Systems) Blueprint$/;

function categoryFromWarframestat(i) {
  if (i.productCategory === 'SentinelWeapons') return 'SentinelWeapon';
  if (i.category === 'Warframes') return 'Warframe';
  if (i.category === 'Sentinels') return 'Sentinel';
  return i.category; // Primary, Secondary, Melee, Archwing
}

// "Mercury/Apollodorus (Survival)" -> {planet, node, type}
function parseHeader(h) {
  let planet = null, place = h.trim();
  const slash = place.indexOf('/');
  if (slash >= 0) { planet = place.slice(0, slash).trim(); place = place.slice(slash + 1).trim(); }
  let type = null, node = place;
  const tm = place.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (tm) { node = tm[1].trim(); type = tm[2].trim(); }
  return { planet, node, type };
}

function sectionBetween(html, startId, endId) {
  const s = html.indexOf(`id="${startId}"`);
  if (s < 0) return '';
  const e = endId ? html.indexOf(`id="${endId}"`, s + 1) : html.length;
  return html.slice(s, e < 0 ? html.length : e);
}

// Содержимое реликвий: relicId -> { tier, code, rewards: Map(item -> {item, rarity, chances}) }
function parseRelicContents(html) {
  const sec = sectionBetween(html, 'relicRewards', 'keyRewards');
  const map = new Map();
  const blockRe = /<th colspan="2">([A-Za-z]+) ([A-Za-z]?\d+) Relic \((Intact|Exceptional|Flawless|Radiant)\)<\/th>(.*?)(?=<tr class="blank-row"|<th colspan)/gs;
  let m;
  while ((m = blockRe.exec(sec)) !== null) {
    const [, tier, code, state, body] = m;
    const id = `${tier} ${code}`;
    let relic = map.get(id);
    if (!relic) { relic = { tier, code, rewards: new Map() }; map.set(id, relic); }
    const rowRe = /<td>([^<]+)<\/td><td>([A-Za-z]+) \(([\d.]+)%\)<\/td>/g;
    let r;
    while ((r = rowRe.exec(body)) !== null) {
      const item = r[1].trim();
      const rarity = r[2];
      const chance = parseFloat(r[3]);
      let rw = relic.rewards.get(item);
      if (!rw) { rw = { item, rarity, chances: {} }; relic.rewards.set(item, rw); }
      rw.chances[state] = chance;
    }
  }
  return map;
}

// Где какие реликвии падают: relicId -> Map(locKey -> {planet,node,type,rotation,chance})
// Источник доступности: реликвия доступна, если встречается в миссиях/бонусах.
function parseRelicDrops(html) {
  // Все секции-источники дропа, кроме relicRewards (там в строках — детали, а не реликвии).
  const slices = [
    sectionBetween(html, 'missionRewards', 'relicRewards'),
    sectionBetween(html, 'keyRewards', 'modByAvatar'),
  ].join('');
  const drops = new Map();
  const rowRe = /<tr[^>]*>(.*?)<\/tr>/gs;
  let loc = null, rot = null, m;
  while ((m = rowRe.exec(slices)) !== null) {
    const row = m[1];
    const th = row.match(/<th[^>]*>(.*?)<\/th>/);
    if (th) {
      const t = th[1].trim();
      // Заголовки бонусов со стадиями идут в строке с pad-cell — это подзаголовок-стадия,
      // её игнорируем, сохраняя регион (loc) и ротацию A/B/C (как в прежних данных).
      const isStage = /pad-cell/.test(row);
      if (/^Rotation\b/i.test(t)) rot = t.replace(/^Rotation\s+/i, '');
      else if (isStage) { /* стадия бонуса — пропускаем */ }
      else { loc = t; rot = null; }
      continue;
    }
    if (!loc) continue;
    // Непустые ячейки строки: для миссий их 2 (награда, шанс), для бонусов 3 (pad, награда, шанс).
    const cells = [...row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((c) => c[1].trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const rm = cells[0].match(/^([A-Za-z]+) ([A-Za-z]?\d+) Relic$/);
    if (!rm) continue;
    if (EXCLUDE_LOCATION.test(loc)) continue;
    const id = `${rm[1]} ${rm[2]}`;
    const chanceM = cells[1].match(/([\d.]+)%/);
    const chance = chanceM ? parseFloat(chanceM[1]) : 0;
    const { planet, node, type } = parseHeader(loc);
    const locKey = `${loc}|${rot ?? ''}`;
    let byLoc = drops.get(id);
    if (!byLoc) { byLoc = new Map(); drops.set(id, byLoc); }
    const prev = byLoc.get(locKey);
    if (!prev || chance > prev.chance) byLoc.set(locKey, { planet, node, type, rotation: rot, chance });
  }
  return drops;
}

async function main() {
  console.log('Загружаю официальный droptable Digital Extremes...');
  const html = await fetchWithRetry(DROPTABLE_URL, { cacheFile: HTML_CACHE });

  // Категории оружия — best-effort из warframestat. Несколько источников по надёжности:
  //  catMap     — по точному имени прайма (warframestat, если уже добавил прайм);
  //  baseCatMap — по базовому оружию (для новых праймов: базовая версия есть давно);
  //  savedCat   — коммитнутый запас прошлой удачной сборки (страховка, если API лежит).
  const catMap = new Map();
  const baseCatMap = new Map();
  const savedCat = new Map();
  try {
    const saved = JSON.parse(await readFile(CAT_FILE, 'utf8'));
    for (const [k, v] of Object.entries(saved)) savedCat.set(k, v);
  } catch { /* запаса ещё нет — не страшно */ }
  try {
    console.log('Загружаю категории из warframestat (обогащение)...');
    const items = await fetchWithRetry(ITEMS_URL, { json: true, cacheFile: ITEMS_CACHE });
    for (const i of items) {
      const cat = categoryFromWarframestat(i);
      if (i.isPrime) catMap.set(i.name, cat);
      else baseCatMap.set(i.name, cat);
    }
  } catch (e) {
    console.log(`⚠ warframestat недоступен (${e.message}) — категории беру из коммитнутого запаса.`);
  }

  const relicContents = parseRelicContents(html);
  const relicDrops = parseRelicDrops(html);
  console.log(`Реликвий с содержимым: ${relicContents.size} | падающих в миссиях: ${relicDrops.size}`);

  const order = { Rare: 0, Uncommon: 1, Common: 2 };
  const relics = [];
  const partDrops = new Map();        // partName -> [{relic, tier, rarity, chances}]
  const availOwners = new Set();       // праймы, чьи детали реально доступны

  // Реликвия попадает на сайт, только если реально падает (есть в relicDrops).
  for (const [id, content] of [...relicContents].sort((a, b) => a[0].localeCompare(b[0]))) {
    const byLoc = relicDrops.get(id);
    if (!byLoc) continue; // ваултнутая — пропускаем
    const rewards = [...content.rewards.values()];
    rewards.sort((a, b) => order[a.rarity] - order[b.rarity] || a.item.localeCompare(b.item));

    for (const rw of rewards) {
      const owner = ownerOf(rw.item);
      rw.available = Boolean(owner);
      if (owner) {
        availOwners.add(owner);
        const list = partDrops.get(rw.item) || [];
        list.push({ relic: id, tier: content.tier, rarity: rw.rarity, chances: rw.chances });
        partDrops.set(rw.item, list);
      }
    }

    const missions = [...byLoc.values()].sort((a, b) => b.chance - a.chance);
    relics.push({
      id, tier: content.tier, code: content.code,
      image: `Relic${content.tier}D.png`,
      rewards: rewards.map((rw) => ({ item: rw.item, rarity: rw.rarity, available: rw.available, chances: rw.chances })),
      missions,
    });
  }

  // Собираем предметы из доступных праймов.
  const items = [...availOwners].map((name) => {
    const parts = [];
    for (const [partName, drops] of partDrops) {
      if (ownerOf(partName) === name) parts.push({ name: partName, short: shortPart(partName, name), drops });
    }
    parts.sort((a, b) => a.name.localeCompare(b.name));
    const isFrame = parts.some((p) => FRAME_PART.test(p.short));
    const baseName = name.replace(/ Prime$/, '');
    const category = isFrame
      ? 'Warframe'
      : (catMap.get(name) || baseCatMap.get(baseName) || savedCat.get(name) || null);
    return { name, image: `${name.replace(/\s+/g, '')}.png`, category, parts };
  })
    .filter((it) => it.parts.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Защита: если парсинг дал явно мусорный результат — не перезаписываем живые данные.
  if (relics.length < 20 || items.length < 8) {
    throw new Error(`Подозрительно мало данных (реликвий ${relics.length}, предметов ${items.length}) — прерываю, чтобы не сломать сайт.`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    states: STATES,
    cdn: CDN,
    counts: { items: items.length, relics: relics.length, parts: partDrops.size },
    items,
    relics,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out));

  // Обновляем коммитнутый запас категорий: запоминаем то, что определилось,
  // плюс сохраняем прежние записи (чтобы запас не худел при разовом сбое API).
  const cats = Object.fromEntries(savedCat);
  for (const it of items) if (it.category) cats[it.name] = it.category;
  await writeFile(CAT_FILE, JSON.stringify(cats, null, 2) + '\n');

  const totalMissions = relics.reduce((s, r) => s + r.missions.length, 0);
  console.log(`\nГотово: ${OUT_FILE} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
  console.log(`Предметы: ${out.counts.items} | реликвии: ${out.counts.relics} | детали: ${out.counts.parts} | источников: ${totalMissions}`);
  const byCat = {};
  for (const it of items) byCat[it.category || 'unknown'] = (byCat[it.category || 'unknown'] || 0) + 1;
  console.log('По категориям:', JSON.stringify(byCat));
}

main().catch((err) => { console.error('Ошибка сборки:', err.message); process.exit(1); });
