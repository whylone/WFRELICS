// Глобальное состояние WFRELICS (Alpine store).
// Данные грузятся «вживую» из data/primes.json (английский, как в API).
// Переводится только ИНТЕРФЕЙС: EN (по умолчанию) / RU.
(function () {
  'use strict';

  const I18N = {
    en: {
      nav_catalog: 'Catalog', nav_relics: 'Relics', nav_optimizer: 'Optimizer',
      selected: 'Selected parts', status: 'Status', online: 'ONLINE', sync: 'SYNC…',
      rec: 'REC', items_short: 'items', relics_short: 'relics',
      lang_label: 'EN', loading: 'Loading telemetry…',
      data_error: 'Data error', data_hint: 'run node tools/build-data.mjs and open via a local server (npx serve or python -m http.server).',
      cat_label: '01 — Catalog', cat_title: 'Prime items',
      cat_sub: 'Tick the parts you need — you don\'t need the whole item, just its piece. Selection feeds the Optimizer.',
      search: 'Search', all: 'All', parts: 'parts', nothing: 'Nothing found',
      select_all: 'All parts', select_all_visible: 'Select all shown', clear_all_visible: 'Clear all shown',
      rel_label: '02 — Registry', rel_title: 'Relics',
      rel_sub: 'Relics currently in rotation and their rewards. Red = active prime parts (you can tick them).',
      tier: 'Tier', best_farm: 'Best farm', drops_from: 'Drops from',
      opt_label: '03 — Farm optimizer', opt_title: 'Where to farm',
      opt_sub: 'Pick parts in the Catalog — here are the best places to farm them. Spots where several of your relics drop are ranked highest.',
      refine: 'Refinement', reset: 'Clear selection', empty_title: '[ SELECTION EMPTY ]',
      empty_text: 'Open the Catalog and tick the parts you want.',
      filter_type: 'Mission type', col_loc: 'Location', col_type: 'Type', col_eff: 'Avg chance / run',
      col_gets: 'What you get here', col_runs: 'avg runs', via: 'from', rotation: 'Rotation',
      no_relics: 'Selected parts are not in any available relic',
      rot_legend: 'Rotation A/B/C = reward rounds. In endless missions the reward table cycles A, A, B, C… the longer you stay, so C is the deepest.',
      note: 'Avg chance/run = expected chance to get one of your wanted parts per mission reward (relic drop × part chance for unrefined relics). Where several target relics share a spot, the chances are summed. avg runs = rewards until your first wanted part.',
      footer: 'FAN PROJECT // NO AFFILIATION', data_sync: 'Data sync',
      cat: { Warframe: 'Warframes', Primary: 'Primary', Secondary: 'Secondary', Melee: 'Melee', Sentinel: 'Sentinels', SentinelWeapon: 'Sentinel weapons', Archwing: 'Archwing' },
      state: { Intact: 'Intact', Exceptional: 'Exceptional', Flawless: 'Flawless', Radiant: 'Radiant' },
    },
    ru: {
      nav_catalog: 'Каталог', nav_relics: 'Реликвии', nav_optimizer: 'Оптимизатор',
      selected: 'Выбрано деталей', status: 'Статус', online: 'ОНЛАЙН', sync: 'СИНХР…',
      rec: 'БАЗА', items_short: 'предм.', relics_short: 'реликв.',
      lang_label: 'RU', loading: 'Загрузка телеметрии…',
      data_error: 'Ошибка данных', data_hint: 'запусти node tools/build-data.mjs и открой через локальный сервер (npx serve или python -m http.server).',
      cat_label: '01 — Каталог', cat_title: 'Прайм-предметы',
      cat_sub: 'Отметь нужные детали — тебе не нужен весь предмет, только его часть. Выбранное уходит в Оптимизатор.',
      search: 'Поиск', all: 'Все', parts: 'дет.', nothing: 'Ничего не найдено',
      select_all: 'Все детали', select_all_visible: 'Выбрать все', clear_all_visible: 'Снять все',
      rel_label: '02 — Реестр', rel_title: 'Реликвии',
      rel_sub: 'Реликвии в обороте и их награды. Красным — актуальные прайм-детали (можно отметить).',
      tier: 'Уровень', best_farm: 'Лучший фарм', drops_from: 'Падает с',
      opt_label: '03 — Оптимизатор фарма', opt_title: 'Где фармить',
      opt_sub: 'Отметь детали в Каталоге — здесь лучшие места для их фарма. Локации, где падает сразу несколько твоих реликвий, идут выше.',
      refine: 'Рефайн', reset: 'Сбросить выбор', empty_title: '[ ВЫБОР ПУСТ ]',
      empty_text: 'Открой Каталог и отметь нужные детали.',
      filter_type: 'Тип миссии', col_loc: 'Локация', col_type: 'Тип', col_eff: 'Средний шанс / заход',
      col_gets: 'Что тут падает', col_runs: 'заходов', via: 'из', rotation: 'Ротация',
      no_relics: 'Выбранные детали не найдены в доступных реликвиях',
      rot_legend: 'Ротация A/B/C — раунды награды. В бесконечных миссиях таблица идёт по кругу A, A, B, C… чем дольше сидишь, тем дальше: C — самые глубокие.',
      note: 'Средний шанс/заход — ожидаемый шанс получить одну из нужных деталей за одну награду миссии (дроп реликвии × шанс детали для нетронутых реликвий). Где несколько целевых реликвий падают в одном месте — шансы складываются. Заходов — наград до первой нужной детали.',
      footer: 'ФАН-ПРОЕКТ // БЕЗ АФФИЛИАЦИИ', data_sync: 'Синхр. данных',
      cat: { Warframe: 'Варфреймы', Primary: 'Основное', Secondary: 'Вторичное', Melee: 'Ближний бой', Sentinel: 'Стражи', SentinelWeapon: 'Оружие стражей', Archwing: 'Арчвинг' },
      state: { Intact: 'Нетронутая', Exceptional: 'Безупречная', Flawless: 'Совершенная', Radiant: 'Сияющая' },
    },
  };
  const CAT_ORDER = ['Warframe', 'Primary', 'Secondary', 'Melee', 'Sentinel', 'SentinelWeapon', 'Archwing'];
  const TIER_ORDER = ['Lith', 'Meso', 'Neo', 'Axi'];

  function safeParse(s) { try { return JSON.parse(s) || {}; } catch (e) { return {}; } }

  // Паучок на паутине: его можно тянуть, нить тянется за ним, при отпускании
  // он пружинит обратно к точке покоя, не отцепляясь от нити.
  window.spider = function () {
    return {
      ax: 70, ay: 0,        // якорь нити (вверху, на паутине)
      rx: 70, ry: 120,      // точка покоя паучка
      sx: 70, sy: 120,      // текущее положение
      vx: 0, vy: 0,
      dragging: false, raf: null, _move: null, _up: null,
      init() { this.sx = this.rx; this.sy = this.ry; },
      _local(ev) { const r = this.$refs.svg.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; },
      grab(ev) {
        ev.preventDefault();
        this.dragging = true;
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
        this._move = (e) => this.move(e);
        this._up = () => this.release();
        window.addEventListener('pointermove', this._move);
        window.addEventListener('pointerup', this._up);
      },
      move(ev) {
        if (!this.dragging) return;
        const p = this._local(ev);
        let dx = p.x - this.ax, dy = p.y - this.ay;
        const dist = Math.hypot(dx, dy), max = 280;       // нить эластичная, но с пределом
        if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
        if (dy < 4) dy = 4;                                 // не уводим выше якоря
        this.sx = this.ax + dx; this.sy = this.ay + dy;
      },
      release() {
        this.dragging = false;
        window.removeEventListener('pointermove', this._move);
        window.removeEventListener('pointerup', this._up);
        const step = () => {                                // пружина с затуханием
          this.vx = (this.vx + (this.rx - this.sx) * 0.14) * 0.75;
          this.vy = (this.vy + (this.ry - this.sy) * 0.14) * 0.75;
          this.sx += this.vx; this.sy += this.vy;
          if (Math.hypot(this.rx - this.sx, this.ry - this.sy) > 0.4 || Math.hypot(this.vx, this.vy) > 0.4) {
            this.raf = requestAnimationFrame(step);
          } else { this.sx = this.rx; this.sy = this.ry; this.vx = this.vy = 0; this.raf = null; }
        };
        this.raf = requestAnimationFrame(step);
      },
    };
  };

  document.addEventListener('alpine:init', () => {
    window.Alpine.store('wf', {
      loaded: false,
      error: '',
      lang: localStorage.getItem('wf_lang') === 'ru' ? 'ru' : 'en',
      data: { items: [], relics: [], states: ['Intact', 'Exceptional', 'Flawless', 'Radiant'], counts: {}, cdn: 'https://cdn.warframestat.us/img/' },
      selected: safeParse(localStorage.getItem('wf_sel')),
      refinement: 'Intact', // реликвии фармятся без рефайна (нетронутыми)
      itemCat: 'all',
      relicTier: 'all',
      q: '',
      typeSel: {}, // фильтр по типу миссии (пусто = все)

      async load() {
        try {
          const res = await fetch('data/primes.json?t=' + Date.now(), { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          this.data = await res.json();
          this.loaded = true;
        } catch (e) {
          this.error = String((e && e.message) || e);
        }
      },

      // i18n
      t(k) { const d = I18N[this.lang] || I18N.en; return d[k] != null ? d[k] : (I18N.en[k] != null ? I18N.en[k] : k); },
      catName(c) { return (I18N[this.lang].cat[c]) || c; },
      stateName(s) { return (I18N[this.lang].state[s]) || s; },
      setLang(l) { this.lang = l; localStorage.setItem('wf_lang', l); },
      toggleLang() { this.setLang(this.lang === 'en' ? 'ru' : 'en'); },

      // выбор деталей
      toggle(part) { if (this.selected[part]) delete this.selected[part]; else this.selected[part] = true; this.save(); },
      isSel(part) { return !!this.selected[part]; },
      remove(part) { delete this.selected[part]; this.save(); },
      clearSel() { this.selected = {}; this.save(); },
      save() { localStorage.setItem('wf_sel', JSON.stringify(this.selected)); },
      // выбор «все детали» сразу
      allSel(item) { return item.parts.length > 0 && item.parts.every((p) => this.selected[p.name]); },
      someSel(item) { return item.parts.some((p) => this.selected[p.name]); },
      toggleAll(item) {
        const on = !this.allSel(item);
        for (const p of item.parts) { if (on) this.selected[p.name] = true; else delete this.selected[p.name]; }
        this.save();
      },
      selectAllVisible() { for (const it of this.filteredItems()) for (const p of it.parts) this.selected[p.name] = true; this.save(); },
      clearAllVisible() { for (const it of this.filteredItems()) for (const p of it.parts) delete this.selected[p.name]; this.save(); },
      get selKeys() { return Object.keys(this.selected).filter((k) => this.selected[k]); },
      get selCount() { return this.selKeys.length; },
      get ranked() { return window.WFCalc.rankRelics(this.data, this.selected, this.refinement); },
      // локации-первыми (главный режим оптимизатора)
      get locsAll() { return window.WFCalc.rankLocations(this.data, this.selected, this.refinement, null); },
      get locations() { return window.WFCalc.rankLocations(this.data, this.selected, this.refinement, this.typeSel); },
      availTypes() { const s = new Set(); for (const l of this.locsAll) if (l.type) s.add(l.type); return [...s].sort(); },
      toggleType(t) { if (this.typeSel[t]) delete this.typeSel[t]; else this.typeSel[t] = true; },
      typeOn(t) { return !!this.typeSel[t]; },
      clearTypes() { this.typeSel = {}; },
      get typeCount() { return Object.keys(this.typeSel).filter((k) => this.typeSel[k]).length; },

      // фильтры/списки
      cats() { return ['all'].concat(CAT_ORDER.filter((c) => this.data.items.some((i) => i.category === c))); },
      tiers() { return ['all'].concat(TIER_ORDER.filter((t) => this.data.relics.some((r) => r.tier === t))); },
      filteredItems() {
        const q = this.q.trim().toLowerCase();
        return this.data.items.filter((i) => (this.itemCat === 'all' || i.category === this.itemCat) && (!q || i.name.toLowerCase().includes(q)));
      },
      filteredRelics() { return this.data.relics.filter((r) => this.relicTier === 'all' || r.tier === this.relicTier); },

      // утилиты
      cdn(name) { return name ? this.data.cdn + encodeURIComponent(name) : ''; },
      fmt(n) { if (n == null) return '0'; return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100); },
      expected(p) { const v = window.WFCalc.expectedRuns(p); return isFinite(v) ? v : '∞'; },
      missionLabel(m) {
        if (!m) return '—';
        return (m.planet ? m.planet + ' / ' : '') + m.node + (m.type ? ' (' + m.type + ')' : '');
      },
      rotLabel(m) { return m && m.rotation ? this.t('rotation') + ' ' + m.rotation : ''; },
      rarityClass(r) { return r === 'Rare' ? 'text-haz' : r === 'Uncommon' ? 'text-txt' : 'text-dim'; },
    });

    window.Alpine.store('wf').load();
  });
})();
