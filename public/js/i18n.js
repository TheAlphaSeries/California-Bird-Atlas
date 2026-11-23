// Interface languages.
//
// The site is written in English. When a reader picks another language, this module swaps the interface text
// (menus, buttons, labels, short help lines) for a translation after each page is drawn. It does not touch:
//   - bird names, photographer names, captions and stories (they are data, not interface),
//   - long editorial pages (About, the scoring table, cover essays), which stay in English for now,
//   - the editor's tool pages.
// So no view has to know about languages: views keep writing English, and translate() runs over the result.
//
// Where the words live: tools/i18n/strings.txt (one line per piece of text, easy to hand to a reviewer),
// built into public/data/i18n.json by tools/i18n/build.py. Dynamic text with numbers or dates is handled by
// PATTERNS below. Anything with no translation is left in English, so a missing line never breaks a page.
//
// Mark an element with data-noi18n to keep everything inside it as written.

export const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['zh', '中文（繁體）'], ['tl', 'Tagalog'], ['vi', 'Tiếng Việt'], ['ko', '한국어'],
];
const KEY = 'wi.lang';
const HTML_LANG = { en: 'en', es: 'es', zh: 'zh-Hant', tl: 'tl', vi: 'vi', ko: 'ko' };
const ATTRS = ['placeholder', 'aria-label', 'title'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'svg']);

export let lang = pick();
let dict = null; // English -> translation for the current language

function pick() {
  try { const s = localStorage.getItem(KEY); if (s && LANGS.some(([c]) => c === s)) return s; } catch { /* storage off */ }
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const c = String(l).toLowerCase().split('-')[0];
    if (c === 'fil') return 'tl';
    if (LANGS.some(([k]) => k === c)) return c;
  }
  return 'en';
}

// Load the dictionary (once) and set <html lang>. Call before the first page is drawn.
export async function initI18n() {
  document.documentElement.lang = HTML_LANG[lang];
  if (lang === 'en') return;
  try {
    const r = await fetch('/data/i18n.json');
    dict = (await r.json())[lang] || null;
  } catch { dict = null; }
  if (lang === 'zh' || lang === 'ko') { // CJK fonts, loaded only for readers who need them
    const fam = lang === 'zh' ? 'Noto+Sans+TC:wght@400;700;900&family=Noto+Serif+TC:wght@600;900' : 'Noto+Sans+KR:wght@400;700;900&family=Noto+Serif+KR:wght@600;900';
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
    document.head.append(l);
  }
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') one(m.target);
      else m.addedNodes.forEach((n) => translate(n));
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function setLang(c) {
  try { localStorage.setItem(KEY, c); } catch { /* storage off */ }
  location.reload(); // simplest way to redraw every piece of text from English
}

// The picker that sits in the yellow strip. Language names are shown in their own language.
export function langPicker() {
  return `<label class="lang-pick" data-noi18n><span class="sr-only">Language</span><select id="lang-select" aria-label="Language">
    ${LANGS.map(([c, n]) => `<option value="${c}"${c === lang ? ' selected' : ''} lang="${HTML_LANG[c]}">${n}</option>`).join('')}</select></label>`;
}
export function bindLangPicker() {
  const s = document.getElementById('lang-select');
  if (s) s.onchange = () => setLang(s.value);
}

// ---- Translating a piece of the page ----

const norm = (s) => s.replace(/\s+/g, ' ').trim();

export function t(en) { // translate one English string, or return it unchanged
  if (!dict) return en;
  const k = norm(en);
  if (dict[k]) return dict[k];
  for (const [re, f] of PATTERNS) { const m = re.exec(k); if (m) { const r = f(m); if (r) return r; } }
  return en;
}

function skipped(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.nodeType === 1 && (e.hasAttribute('data-noi18n') || SKIP_TAGS.has(e.tagName) || e.isContentEditable)) return true;
  }
  return document.body.classList.contains('tool');
}

function one(node) { // a single text node
  const v = node.nodeValue;
  if (!v || !/[A-Za-z]/.test(v)) return;
  const out = t(v);
  if (out !== v) {
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    const nv = lead + out + trail;
    if (nv !== v && !skipped(node.parentElement)) node.nodeValue = nv;
  }
}

export function translate(root = document.body) {
  if (!dict || !root) return;
  if (root.nodeType === 3) { one(root); return; }
  if (root.nodeType !== 1 || skipped(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && (n.hasAttribute('data-noi18n') || SKIP_TAGS.has(n.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts = [], els = [root];
  for (let n = w.nextNode(); n; n = w.nextNode()) (n.nodeType === 3 ? texts : els).push(n);
  texts.forEach(one);
  for (const el of els) for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v && /[A-Za-z]/.test(v)) { const o = t(v); if (o !== v) el.setAttribute(a, o); }
  }
}

// ---- Text with numbers, dates and region names in it ----

const season = (s) => t(s);
const region = (r) => t(r);
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
const LOC = { es: 'es', zh: 'zh-Hant', tl: 'fil', vi: 'vi', ko: 'ko' };
function day(mon, d, long) {
  try { return new Intl.DateTimeFormat(LOC[lang], { month: long ? 'long' : 'short', day: 'numeric' }).format(new Date(2026, MON[mon], +d)); }
  catch { return `${mon} ${d}`; }
}
const DATE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\\d{1,2})';

// Each entry: [regex over the whole (space-collapsed) string, m => translation for the current language].
// The tables are written per language so word order can differ.
const L = (o) => o[lang];
const PATTERNS = [
  [/^(\d+) points? each$/, (m) => L({ es: `${m[1]} puntos cada una`, zh: `每種 ${m[1]} 分`, tl: `${m[1]} puntos bawat isa`, vi: `${m[1]} điểm mỗi loài`, ko: `마리당 ${m[1]}점` })],
  [/^(?:Issue )?No\. (\d+)$/, (m) => L({ es: `N.º ${m[1]}`, zh: `第 ${m[1]} 期`, tl: `Blg. ${m[1]}`, vi: `Số ${m[1]}`, ko: `제${m[1]}호` })],
  [/^Level (\d)$/, (m) => L({ es: `Nivel ${m[1]}`, zh: `難度 ${m[1]}`, tl: `Antas ${m[1]}`, vi: `Mức ${m[1]}`, ko: `난이도 ${m[1]}` })],
  [/^(Winter|Spring|Summer|Fall) \(now\)$/, (m) => L({ es: `${season(m[1])} (ahora)`, zh: `${season(m[1])}（現在）`, tl: `${season(m[1])} (ngayon)`, vi: `${season(m[1])} (hiện tại)`, ko: `${season(m[1])} (지금)` })],
  [/^(Winter|Spring|Summer|Fall) (\d{4}(?:–\d{2})?)$/, (m) => L({ es: `${season(m[1])} ${m[2]}`, zh: `${m[2]} ${season(m[1])}`, tl: `${season(m[1])} ${m[2]}`, vi: `${season(m[1])} ${m[2]}`, ko: `${m[2]} ${season(m[1])}` })],
  [/^(Winter|Spring|Summer|Fall) (\d{4}), assignment (\d+) of (\d+)$/, (m) => L({
    es: `${season(m[1])} ${m[2]}, asignación ${m[3]} de ${m[4]}`, zh: `${m[2]} ${season(m[1])}，第 ${m[3]}／${m[4]} 次任務`,
    tl: `${season(m[1])} ${m[2]}, assignment ${m[3]} sa ${m[4]}`, vi: `${season(m[1])} ${m[2]}, đợt ${m[3]}/${m[4]}`, ko: `${m[2]} ${season(m[1])}, 과제 ${m[3]}/${m[4]}` })],
  [new RegExp(`^${DATE} – ${DATE}$`), (m) => `${day(m[1], m[2])} – ${day(m[3], m[4])}`],
  [new RegExp(`^(.+), ${DATE} – ${DATE}\\.$`), (m) => `${region(m[1])}, ${day(m[2], m[3])} – ${day(m[4], m[5])}.`],
  [/^Assigned now in the (.+)$/, (m) => L({ es: `Asignadas ahora en ${region(m[1])}`, zh: `${region(m[1])}目前的任務`, tl: `Nakatalaga ngayon sa ${region(m[1])}`, vi: `Đang giao ở ${region(m[1])}`, ko: `지금 ${region(m[1])} 과제` })],
  [/^Assigned now in (.+)$/, (m) => L({ es: `Asignadas ahora en ${region(m[1])}`, zh: `${region(m[1])}目前的任務`, tl: `Nakatalaga ngayon sa ${region(m[1])}`, vi: `Đang giao ở ${region(m[1])}`, ko: `지금 ${region(m[1])} 과제` })],
  [/^Your region: (.+)\. Change region$/, (m) => L({ es: `Tu región: ${region(m[1])}. Cambiar de región`, zh: `你的地區：${region(m[1])}。更改地區`, tl: `Iyong rehiyon: ${region(m[1])}. Palitan ang rehiyon`, vi: `Vùng của bạn: ${region(m[1])}. Đổi vùng`, ko: `나의 지역: ${region(m[1])}. 지역 변경` })],
  [/^Arriving this (winter|spring|summer|fall)$/, (m) => L({ es: `Llegan este ${t(cap(m[1])).toLowerCase()}`, zh: `本${t(cap(m[1]))}抵達`, tl: `Darating ngayong ${t(cap(m[1])).toLowerCase()}`, vi: `Đến trong ${t(cap(m[1])).toLowerCase()} này`, ko: `이번 ${t(cap(m[1]))}에 오는 새` })],
  [/^(\d+) birds that weren't here in (winter|spring|summer|fall)$/, (m) => L({ es: `${m[1]} aves que no estaban en ${t(cap(m[2])).toLowerCase()}`, zh: `${m[1]} 種${t(cap(m[2]))}時不在這裡的鳥`, tl: `${m[1]} ibong wala rito noong ${t(cap(m[2])).toLowerCase()}`, vi: `${m[1]} loài không có ở đây vào ${t(cap(m[2])).toLowerCase()}`, ko: `${t(cap(m[2]))}에는 없던 새 ${m[1]}종` })],
  [/^(\d+) species on the official California list\.$/, (m) => L({ es: `${m[1]} especies en la lista oficial de California.`, zh: `加州官方名錄共 ${m[1]} 種。`, tl: `${m[1]} species sa opisyal na listahan ng California.`, vi: `${m[1]} loài trong danh sách chính thức của California.`, ko: `캘리포니아 공식 목록 ${m[1]}종.` })],
  [/^(\d+) birds? on the wall$/, (m) => L({ es: `${m[1]} aves en el muro`, zh: `鳥牆上有 ${m[1]} 隻鳥`, tl: `${m[1]} ibon sa wall`, vi: `${m[1]} con chim trên tường`, ko: `갤러리에 새 ${m[1]}마리` })],
  [new RegExp(`^Any of the nine counts, and so does any bird from an earlier assignment this season, until ${DATE}\\. (\\d+) other birds can be found in (?:the )?(.+) this (winter|spring|summer|fall), and photos of those count too\\.$`), (m) => {
    const d = day(m[1], m[2]), s = t(cap(m[5])), r = region(m[4]);
    return L({
      es: `Cualquiera de las nueve cuenta, y también cualquier ave de una asignación anterior de esta temporada, hasta el ${d}. Hay otras ${m[3]} aves en ${r} este ${s.toLowerCase()}, y sus fotos también cuentan.`,
      zh: `九種鳥中任何一種都算，本季先前任務的鳥也算，直到 ${d}。本${s}在${r}還能找到另外 ${m[3]} 種鳥，牠們的照片也算數。`,
      tl: `Bilang ang alinman sa siyam, pati ang anumang ibon mula sa naunang assignment ngayong season, hanggang ${d}. May ${m[3]} pang ibon na makikita sa ${r} ngayong ${s.toLowerCase()}, at bilang din ang mga larawan nila.`,
      vi: `Bất kỳ loài nào trong chín loài đều được tính, cả các loài của đợt trước trong mùa này, đến ${d}. Còn ${m[3]} loài khác có thể tìm thấy ở ${r} trong ${s.toLowerCase()} này, và ảnh của chúng cũng được tính.`,
      ko: `아홉 마리 중 어느 새든, 이번 시즌 이전 과제의 새도 ${d}까지 인정됩니다. 이번 ${s}에 ${r}에서 볼 수 있는 다른 새 ${m[3]}종의 사진도 인정됩니다.`,
    });
  }],
  [/^In (?:the )?(.+), look (at any time of year|in (?:winter|spring|summer|fall)(?:(?:, | or )(?:winter|spring|summer|fall))*), when it is (easy to find|worth a trip|hard to find)\.$/, (m) => {
    const any = m[2] === 'at any time of year';
    const ss = any ? [] : m[2].slice(3).split(/, | or /).map((x) => t(cap(x)));
    const lvl = { 'easy to find': t('easy to find'), 'worth a trip': t('takes a trip'), 'hard to find': L({ es: 'difícil de encontrar', zh: '很難找到', tl: 'mahirap hanapin', vi: 'khó tìm', ko: '찾기 어려움' }) }[m[3]];
    const r = region(m[1]);
    const join = (sep, last) => ss.length > 1 ? ss.slice(0, -1).join(sep) + last + ss[ss.length - 1] : ss[0];
    return L({
      es: `En ${r}, búscala ${any ? 'en cualquier época del año' : 'en ' + join(', ', ' o ').toLowerCase()}, cuando es ${lvl}.`,
      zh: `在${r}，${any ? '一年四季' : join('、', '或')}都可以找，這時${lvl}。`,
      tl: `Sa ${r}, hanapin ito ${any ? 'anumang oras ng taon' : 'sa ' + join(', ', ' o ').toLowerCase()}, kapag ${lvl} ito.`,
      vi: `Ở ${r}, hãy tìm ${any ? 'vào bất kỳ thời điểm nào trong năm' : 'vào ' + join(', ', ' hoặc ').toLowerCase()}, khi nó ${lvl}.`,
      ko: `${r}에서는 ${any ? '일 년 내내' : join(', ', ' 또는 ')}에 찾아보세요. 이때 ${lvl}입니다.`,
    });
  }],
  [/^Not dependable in (?:the )?(.+)\. The table shows where it is\.$/, (m) => L({ es: `Poco fiable en ${region(m[1])}. La tabla muestra dónde está.`, zh: `在${region(m[1])}不一定看得到。表格顯示牠在哪裡。`, tl: `Hindi maaasahan sa ${region(m[1])}. Makikita sa talahanayan kung nasaan ito.`, vi: `Không chắc chắn ở ${region(m[1])}. Bảng cho thấy nơi có nó.`, ko: `${region(m[1])}에서는 불확실합니다. 표에서 어디에 있는지 확인하세요.` })],
  [/^(.+) · ([\d /]+) points by level$/, (m) => `${t(m[1])} · ` + L({ es: `${m[2]} puntos según el nivel`, zh: `依難度 ${m[2]} 分`, tl: `${m[2]} puntos ayon sa antas`, vi: `${m[2]} điểm theo mức`, ko: `난이도별 ${m[2]}점` })],
  [/^([\d /]+) points by level$/, (m) => L({ es: `${m[1]} puntos según el nivel`, zh: `依難度 ${m[1]} 分`, tl: `${m[1]} puntos ayon sa antas`, vi: `${m[1]} điểm theo mức`, ko: `난이도별 ${m[1]}점` })],
  [/^(.+) · (\d+) points$/, (m) => `${t(m[1])} · ` + L({ es: `${m[2]} puntos`, zh: `${m[2]} 分`, tl: `${m[2]} puntos`, vi: `${m[2]} điểm`, ko: `${m[2]}점` })],
  [/^(\d+) points$/, (m) => L({ es: `${m[1]} puntos`, zh: `${m[1]} 分`, tl: `${m[1]} puntos`, vi: `${m[1]} điểm`, ko: `${m[1]}점` })],
  [/^(.+) · (no points|No points)$/, (m) => `${t(m[1])} · ${t(m[2])}`],
  [/^in the (.+)\.$/, (m) => { // "… in the Bay Area, Central Coast and Deserts." after a bold lead-in
    const parts = m[1].split(/, | and /);
    if (!parts.every((x) => dict[x])) return null;
    const rs = parts.map(region), and = L({ es: ' y ', zh: '、', tl: ' at ', vi: ' và ', ko: ', ' });
    const list = rs.length > 1 ? rs.slice(0, -1).join(lang === 'zh' ? '、' : ', ') + and + rs[rs.length - 1] : rs[0];
    return L({ es: `en ${list}.`, zh: `（${list}）。`, tl: `sa ${list}.`, vi: `ở ${list}.`, ko: `: ${list}.` });
  }],
  [/^Findable in (?:the )?(.+) now$/, (m) => L({ es: `Se pueden encontrar ahora en ${region(m[1])}`, zh: `現在在${region(m[1])}找得到`, tl: `Makikita ngayon sa ${region(m[1])}`, vi: `Có thể tìm thấy ở ${region(m[1])} lúc này`, ko: `지금 ${region(m[1])}에서 볼 수 있음` })],
  [/^(.+?): (Opens .+|Open now.+|Closed.+)$/, (m) => { const r = t(m[2]); return r === m[2] ? null : `${m[1]}: ${r}`; }], // the strip: "<issue theme>: Opens …"
  [/^Open now\.(?: Closes (\w+) (\d+), in (\d+) days?\.)?$/, (m) => {
    const head = L({ es: 'Abierto ahora.', zh: '現正開放。', tl: 'Bukas na ngayon.', vi: 'Đang mở.', ko: '지금 접수 중.' });
    if (!m[1] || MON[m[1]] === undefined) return m[1] ? null : head;
    const d = day(m[1], m[2], true);
    return head + ' ' + L({ es: `Cierra el ${d}, en ${m[3]} días.`, zh: `${d}截止，還有 ${m[3]} 天。`, tl: `Magsasara sa ${d}, sa loob ng ${m[3]} araw.`, vi: `Đóng ngày ${d}, còn ${m[3]} ngày.`, ko: `${d} 마감, ${m[3]}일 남음.` });
  }],
  [/^Closed (\w+) (\d+)\.$/, (m) => MON[m[1]] === undefined ? null : L({ es: `Cerrado el ${day(m[1], m[2], true)}.`, zh: `已於${day(m[1], m[2], true)}截止。`, tl: `Nagsara noong ${day(m[1], m[2], true)}.`, vi: `Đã đóng ngày ${day(m[1], m[2], true)}.`, ko: `${day(m[1], m[2], true)} 마감됨.` })],
  [/^(Winter|Spring|Summer|Fall) (\d+) of (\d+)$/, (m) => L({ es: `${season(m[1])} ${m[2]} de ${m[3]}`, zh: `${season(m[1])} 第 ${m[2]}／${m[3]} 次`, tl: `${season(m[1])} ${m[2]} sa ${m[3]}`, vi: `${season(m[1])} ${m[2]}/${m[3]}`, ko: `${season(m[1])} ${m[2]}/${m[3]}` })],
  [new RegExp(`^Photo of the week, ${DATE} – ${DATE}$`), (m) => L({ es: 'Foto de la semana', zh: '本週照片', tl: 'Larawan ng linggo', vi: 'Ảnh của tuần', ko: '이번 주의 사진' }) + `, ${day(m[1], m[2])} – ${day(m[3], m[4])}`],
  [/^on the wall since (\w+) (\d{4})$/, (m) => { let mo = m[1]; try { mo = new Intl.DateTimeFormat(LOC[lang], { month: 'long', year: 'numeric' }).format(new Date(+m[2], MON[m[1]], 15)); } catch { /* keep English */ } return L({ es: `en el muro desde ${mo}`, zh: `自${mo}起在鳥牆上`, tl: `nasa wall mula ${mo}`, vi: `trên tường từ ${mo}`, ko: `${mo}부터 갤러리 참여` }); }],
  [/^All (\d+) on the wall$/, (m) => L({ es: `Las ${m[1]} en el muro`, zh: `鳥牆上全部 ${m[1]} 張`, tl: `Lahat ng ${m[1]} sa wall`, vi: `Cả ${m[1]} ảnh trên tường`, ko: `갤러리의 ${m[1]}장 모두 보기` })],
  [/^Open (.+)$/, (m) => L({ es: `Abrir ${m[1]}`, zh: `開啟 ${m[1]}`, tl: `Buksan ang ${m[1]}`, vi: `Mở ${m[1]}`, ko: `${m[1]} 열기` })],
  [/^In the (.+)$/, (m) => dict[m[1]] ? L({ es: `En ${region(m[1])}`, zh: `在${region(m[1])}`, tl: `Sa ${region(m[1])}`, vi: `Ở ${region(m[1])}`, ko: `${region(m[1])}에서` }) : null],
  [/^(Winter|Spring|Summer|Fall), by region$/, (m) => L({ es: `${season(m[1])}, por región`, zh: `${season(m[1])}，各地區`, tl: `${season(m[1])}, ayon sa rehiyon`, vi: `${season(m[1])}, theo vùng`, ko: `${season(m[1])}, 지역별` })],
  [/^Times for (.+)\. Elsewhere in the region they're within a few minutes\.$/, (m) => L({ es: `Horas para ${m[1]}. En el resto de la región varían pocos minutos.`, zh: `以 ${m[1]} 計算。區內其他地方相差幾分鐘以內。`, tl: `Oras para sa ${m[1]}. Sa ibang bahagi ng rehiyon, ilang minuto lang ang diperensya.`, vi: `Giờ tính cho ${m[1]}. Nơi khác trong vùng chỉ lệch vài phút.`, ko: `${m[1]} 기준 시각입니다. 지역 내 다른 곳은 몇 분 차이입니다.` })],
  [/^Give a heart to the photos you like best\. The one with the most \(at least (\d+)\) wins Readers' Choice when the issue closes\.$/, (m) => L({ es: `Dale un corazón a las fotos que más te gusten. La que tenga más (al menos ${m[1]}) gana la Elección de los lectores cuando cierre el número.`, zh: `為你最喜歡的照片按愛心。本期截止時，愛心最多（至少 ${m[1]} 個）的照片獲選讀者票選。`, tl: `Mag-heart sa mga larawang pinakagusto mo. Ang may pinakamarami (hindi bababa sa ${m[1]}) ang mananalo ng Pinili ng mga Mambabasa pagsara ng isyu.`, vi: `Thả tim cho những ảnh bạn thích nhất. Ảnh nhiều tim nhất (ít nhất ${m[1]}) sẽ thắng giải Độc giả bình chọn khi số báo đóng.`, ko: `가장 마음에 드는 사진에 하트를 주세요. 이번 호가 마감될 때 하트가 가장 많은(최소 ${m[1]}개) 사진이 독자 선정작이 됩니다.` })],
  [/^(\d+) photos?$/, (m) => L({ es: `${m[1]} fotos`, zh: `${m[1]} 張照片`, tl: `${m[1]} larawan`, vi: `${m[1]} ảnh`, ko: `사진 ${m[1]}장` })],
  [/^(\d+) species$/, (m) => L({ es: `${m[1]} especies`, zh: `${m[1]} 種`, tl: `${m[1]} species`, vi: `${m[1]} loài`, ko: `${m[1]}종` })],
  [/^(\d+) birds?$/, (m) => L({ es: `${m[1]} aves`, zh: `${m[1]} 種鳥`, tl: `${m[1]} ibon`, vi: `${m[1]} loài chim`, ko: `새 ${m[1]}종` })],
  [/^Opens (January|February|March|April|May|June|July|August|September|October|November|December) (\d+), in (\d+) days?\.(.*)$/, (m) => {
    const d = day(m[1], m[2], true), rest = m[4].trim() === 'Photos sent now are held for it.' ? L({ es: ' Las fotos enviadas ahora se guardan para él.', zh: '現在傳送的照片會保留給這一期。', tl: ' Itatabi para rito ang mga larawang ipapadala ngayon.', vi: ' Ảnh gửi bây giờ sẽ được giữ cho số này.', ko: ' 지금 보낸 사진은 이번 호를 위해 보관됩니다.' }) : (m[4] ? null : '');
    if (rest === null) return null;
    return L({ es: `Abre el ${d}, en ${m[3]} días.`, zh: `${d}開放，還有 ${m[3]} 天。`, tl: `Magbubukas sa ${d}, sa loob ng ${m[3]} araw.`, vi: `Mở ngày ${d}, còn ${m[3]} ngày.`, ko: `${d} 시작, ${m[3]}일 남음.` }) + rest;
  }],
];
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
