// Сборщик данных для WFRELICS.
// Собирает ВСЕ актуальные (не ваултнутые) прайм-предметы всех категорий и
// доступные реликвии — с наградами, шансами по рефайнам и ВСЕМИ источниками-миссиями.
// Данные на английском (как в API). Пишет data/primes.json (грузится сайтом «вживую»).
//
// Запуск:  node tools/build-data.mjs
// Требуется Node 18+ (глобальный fetch).

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data');
const OUT_FILE = join(OUT_DIR, 'primes.json');

const ITEMS_URL = 'https://api.warframestat.us/items/?language=en&only=name,isPrime,vaulted,imageName,category,productCategory';
const RELICS_URL = 'https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/Relics.json';

const STATES = ['Intact', 'Exceptional', 'Flawless', 'Radiant'];

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'WFRELICS-builder' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function categoryOf(i) {
  if (i.productCategory === 'SentinelWeapons') return 'SentinelWeapon';
  if (i.category === 'Warframes') return 'Warframe';
  if (i.category === 'Sentinels') return 'Sentinel';
  return i.category; // Primary, Secondary, Melee, Archwing
}

// Источники, которые не нужны в планировщике фарма:
//  - PvP (Conclave «Faceoff», Lunaro)
//  - ограниченные по времени ивенты (Plague Star, Ghoul Purge) — доступны не всегда
const EXCLUDE_LOCATION = /faceoff|conclave|lunaro|plague star|ghoul/i;
function isExcludedLocation(raw) { return EXCLUDE_LOCATION.test(raw || ''); }

function parseRelicName(name) {
  const parts = name.trim().split(/\s+/);
  let state = 'Intact';
  if (STATES.includes(parts[parts.length - 1])) state = parts.pop();
  return { id: `${parts[0]} ${parts.slice(1).join(' ')}`, tier: parts[0], code: parts.slice(1).join(' '), state };
}

// "Veil Proxima/Sabmir Cloud (Skirmish), Rotation B" -> {planet, node, type, rotation}
function parseLocation(raw) {
  let s = raw;
  let rotation = null;
  const rm = s.match(/,\s*Rotation\s+([A-Za-z0-9]+)\s*$/i);
  if (rm) { rotation = rm[1]; s = s.slice(0, rm.index); }
  let planet = null, place = s.trim();
  const slash = s.indexOf('/');
  if (slash >= 0) { planet = s.slice(0, slash).trim(); place = s.slice(slash + 1).trim(); }
  let type = null, node = place;
  const tm = place.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (tm) { node = tm[1].trim(); type = tm[2].trim(); }
  if (planet && planet.includes(',')) { const ps = planet.split(',').map((x) => x.trim()); planet = ps.pop(); node = (ps.join(', ') + (node ? ' ' + node : '')).trim(); }
  return { planet, node, type, rotation };
}

async function main() {
  console.log('Загружаю каталог предметов...');
  const allItems = await getJSON(ITEMS_URL);
  console.log('Загружаю реликвии...');
  const relicsRaw = await getJSON(RELICS_URL);

  const availItems = allItems
    .filter((i) => i.isPrime === true && i.vaulted === false)
    .map((i) => ({ name: i.name, image: i.imageName || null, category: categoryOf(i) }));
  const allPrimeNames = allItems.filter((i) => i.isPrime).map((i) => i.name).sort((a, b) => b.length - a.length);
  const availNames = new Set(availItems.map((i) => i.name));

  function ownerOf(partName) {
    for (const n of allPrimeNames) if (partName === n || partName.startsWith(n + ' ')) return n;
    return null;
  }
  function shortPart(partName) {
    const owner = ownerOf(partName);
    if (!owner) return partName;
    return partName === owner ? 'Set' : partName.slice(owner.length + 1);
  }

  // редкость по рангу шанса (поле rarity в данных ненадёжно)
  const baseChance = (rw) => rw.chances.Intact ?? rw.chances.Radiant ?? 0;
  function assignRarities(rewards) {
    [...rewards].sort((a, b) => baseChance(b) - baseChance(a)).forEach((rw, i) => {
      rw.rarity = i < 3 ? 'Common' : i < 5 ? 'Uncommon' : 'Rare';
    });
  }

  // группируем не ваултнутые реликвии
  const relicMap = new Map();
  for (const entry of relicsRaw) {
    if (entry.vaulted !== false || !entry.name) continue;
    const { id, tier, code, state } = parseRelicName(entry.name);
    if (!STATES.includes(state)) continue;
    let relic = relicMap.get(id);
    if (!relic) { relic = { id, tier, code, images: {}, rewards: new Map(), missions: new Map() }; relicMap.set(id, relic); }
    if (entry.imageName) relic.images[state] = entry.imageName;
    for (const r of entry.rewards || []) {
      const itemName = r.item?.name;
      if (!itemName) continue;
      let rw = relic.rewards.get(itemName);
      if (!rw) rw = { item: itemName, chances: {} };
      rw.chances[state] = r.chance;
      relic.rewards.set(itemName, rw);
    }
    for (const d of entry.drops || []) {
      if (!d.location) continue;
      if (isExcludedLocation(d.location)) continue; // PvP / временные ивенты
      const prev = relic.missions.get(d.location);
      if (!prev || (d.chance ?? 0) > prev.chance) relic.missions.set(d.location, { ...parseLocation(d.location), chance: d.chance ?? 0 });
    }
  }

  const relics = [];
  const partDrops = new Map();
  const order = { Rare: 0, Uncommon: 1, Common: 2 };
  for (const relic of [...relicMap.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const rewards = [...relic.rewards.values()];
    assignRarities(rewards);
    for (const rw of rewards) {
      const owner = ownerOf(rw.item);
      rw.available = Boolean(owner) && availNames.has(owner);
      if (rw.available) {
        const list = partDrops.get(rw.item) || [];
        list.push({ relic: relic.id, tier: relic.tier, rarity: rw.rarity, chances: rw.chances });
        partDrops.set(rw.item, list);
      }
    }
    rewards.sort((a, b) => order[a.rarity] - order[b.rarity] || a.item.localeCompare(b.item));
    // ВСЕ источники-миссии (по убыванию шанса) — полный список фарма
    const missions = [...relic.missions.values()].sort((a, b) => b.chance - a.chance);
    relics.push({
      id: relic.id, tier: relic.tier, code: relic.code,
      image: relic.images.Intact || Object.values(relic.images)[0] || null,
      rewards: rewards.map((rw) => ({ item: rw.item, rarity: rw.rarity, available: rw.available, chances: rw.chances })),
      missions,
    });
  }

  const items = availItems
    .map((it) => {
      const parts = [];
      for (const [partName, drops] of partDrops) {
        if (ownerOf(partName) === it.name) parts.push({ name: partName, short: shortPart(partName), drops });
      }
      parts.sort((a, b) => a.name.localeCompare(b.name));
      return { ...it, parts };
    })
    .filter((it) => it.parts.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const out = {
    generatedAt: new Date().toISOString(),
    states: STATES,
    cdn: 'https://cdn.warframestat.us/img/',
    counts: { items: items.length, relics: relics.length, parts: partDrops.size },
    items,
    relics,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out));
  const totalMissions = relics.reduce((s, r) => s + r.missions.length, 0);
  console.log(`\nГотово: ${OUT_FILE} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
  const byCat = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] || 0) + 1;
  console.log(`Предметы: ${out.counts.items} | реликвии: ${out.counts.relics} | детали: ${out.counts.parts} | источников: ${totalMissions}`);
  console.log('По категориям:', JSON.stringify(byCat));
}

main().catch((err) => { console.error('Ошибка сборки:', err); process.exit(1); });
