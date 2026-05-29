// Проверяет, что переключатель языка в шапке index.html реально работает
// (баг: кнопка была вне scope Alpine). Запуск: NODE_PATH=<tmp>/node_modules node tools/test-lang.cjs
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ROOT = join(__dirname, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const primes = JSON.parse(read('data/primes.json'));

const dom = new JSDOM(read('index.html'), { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
global.MutationObserver = window.MutationObserver;
global.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
global.navigator = window.navigator;
for (const k of ['CustomEvent', 'Event', 'Node', 'Element', 'ShadowRoot', 'HTMLElement', 'DocumentFragment', 'getComputedStyle', 'HTMLTemplateElement', 'customElements']) global[k] = window[k];
window.fetch = global.fetch = async () => ({ ok: true, status: 200, json: async () => primes });

window.eval(read('js/calc.js'));
window.eval(read('js/store.js'));
// в браузере store.js и Alpine живут в одном window; в тесте Alpine require-ится
// в Node-реалме, поэтому глобальный компонент spider() пробрасываем вручную.
global.spider = window.spider;
let Alpine = require('alpinejs'); Alpine = Alpine.default || Alpine;
window.Alpine = Alpine; Alpine.start();

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const doc = window.document;

(async () => {
  await new Promise((r) => setTimeout(r, 150));
  const store = Alpine.store('wf');
  const btn = doc.querySelector('[data-lang-toggle]');
  ok(!!btn, 'lang toggle button exists in header');
  ok(store.lang === 'en', 'default language EN');

  // текст пункта меню до переключения
  const navCatalog = [...doc.querySelectorAll('nav button span')].find((s) => /Catalog/i.test(s.textContent));
  ok(!!navCatalog, 'nav shows English "Catalog" initially');

  // КЛИК — главный тест бага
  btn.click();
  await new Promise((r) => setTimeout(r, 80));
  ok(store.lang === 'ru', 'click toggles store.lang to RU');
  const navRu = [...doc.querySelectorAll('nav button span')].some((s) => /Каталог/.test(s.textContent));
  ok(navRu, 'header nav re-renders to Russian after toggle');

  // обратно
  btn.click();
  await new Promise((r) => setTimeout(r, 80));
  ok(store.lang === 'en', 'second click toggles back to EN');

  // selected-count binding в шапке тоже в scope (раньше было вне x-data)
  const selSpan = [...doc.querySelectorAll('header b')].some((b) => b.textContent.trim() === '0');
  ok(selSpan, 'header selected-count binding is wired (shows 0)');

  console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`);
  process.exit(fail ? 1 : 0);
})();
