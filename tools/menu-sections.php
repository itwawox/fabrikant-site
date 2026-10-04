<?php
// Окно разметки разделов меню: на картинке страницы обводишь раздел рамкой и пишешь название.
// Из разметки сайт делает кадры разделов на телефоне, оглавление и ссылки вида /menu.php#supy.
//
//   php tools/menu-sections.php
//
// Скрипт запускает маленький сервер только для этого компьютера и открывает окно в браузере.
// «Сохранить» записывает разделы в data/menu.php. Остановить — Ctrl+C в терминале.
//
// Когда размечать: после php tools/new-menu.php. Если в новом меню столько же страниц, разметка
// прошлого меню уже перенесена — останется пролистать страницы и поправить рамки, которые съехали.
// Без разметки сайт показывает меню целыми страницами, как раньше.

const PORT = 8099;

// 1. Запуск из терминала: поднимаем встроенный сервер PHP, он будет вызывать этот же файл
if (PHP_SAPI === 'cli') {
    // Пароль на этот запуск: без него страница сохранения не примет данные, даже если её
    // попробует вызвать чужой сайт, открытый в том же браузере
    $token = bin2hex(random_bytes(16));
    $url = 'http://127.0.0.1:' . PORT . '/?t=' . $token;
    echo "Окно разметки разделов: $url\nОстановить — Ctrl+C\n\n";
    putenv('MENU_EDITOR_TOKEN=' . $token);
    if (PHP_OS_FAMILY === 'Darwin') {
        exec('(sleep 1; open ' . escapeshellarg($url) . ') > /dev/null 2>&1 &');
    }
    passthru(escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . PORT . ' ' . escapeshellarg(__FILE__), $code);
    if ($code !== 0) {
        fwrite(STDERR, "\nСервер не запустился. Если порт " . PORT . " занят — закройте прошлое окно разметки (Ctrl+C).\n");
    }
    exit($code);
}

// 2. Запрос к встроенному серверу. Всё остальное (сайт на хостинге, чужие адреса) — «нет такой страницы»
if (PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'], array('127.0.0.1', '::1'), true)) {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
require $root . '/inc/_menu.php';
$config = $root . '/data/menu.php';
$menu = require $config;
$token = (string) getenv('MENU_EDITOR_TOKEN');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Картинка страницы: /page/3
if (preg_match('#^/page/(\d+)$#', $path, $m)) {
    $n = (int) $m[1];
    $base = $root . '/assets/img/menu/' . $menu['name'] . '-' . $n;
    foreach (array('-1000.webp' => 'image/webp', '.jpg' => 'image/jpeg') as $suffix => $type) {
        if ($n >= 1 && $n <= count($menu['pages']) && is_file($base . $suffix)) {
            header('Content-Type: ' . $type);
            readfile($base . $suffix);
            exit;
        }
    }
    http_response_code(404);
    exit;
}

// Сохранение: JSON со списком разделов
if ($path === '/save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    if ($token === '' || !hash_equals($token, (string) ($_SERVER['HTTP_X_TOKEN'] ?? ''))) {
        http_response_code(403);
        echo json_encode(array('error' => 'Окно устарело: откройте ссылку, которую напечатал терминал.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) || !isset($data['sections']) || !is_array($data['sections'])) {
        http_response_code(400);
        echo json_encode(array('error' => 'Не получилось прочитать разметку.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $sections = array();
    foreach ($data['sections'] as $s) {
        $boxes = array();
        foreach (isset($s['boxes']) && is_array($s['boxes']) ? $s['boxes'] : array() as $b) {
            if (is_array($b) && count($b) === 4) {
                $boxes[] = array_map(function ($v) { return round(max(0, min(1, (float) $v)), 3); }, array_values($b));
            }
        }
        $title = trim(preg_replace('/\s+/u', ' ', (string) ($s['title'] ?? '')));
        $page = (int) ($s['page'] ?? 0);
        if ($title !== '' && $boxes && $page >= 1 && $page <= count($menu['pages'])) {
            $sections[] = array('page' => $page, 'title' => mb_substr($title, 0, 60), 'boxes' => $boxes);
        }
    }
    $menu['sections'] = $sections;
    if (!menu_config_write($config, $menu)) {
        http_response_code(500);
        echo json_encode(array('error' => 'Не получилось записать data/menu.php.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(array('saved' => count($sections)));
    exit;
}

if ($path !== '/') {
    http_response_code(404);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
if ($token === '' || !hash_equals($token, (string) ($_GET['t'] ?? ''))) {
    http_response_code(403);
    echo '<!doctype html><meta charset="utf-8"><p style="font:16px sans-serif;padding:24px">Откройте ссылку, которую напечатал терминал после <code>php tools/menu-sections.php</code>.</p>';
    exit;
}

$state = array(
    'season' => $menu['season'],
    'pages' => $menu['pages'],
    'sections' => array_map(function ($s) {
        return array('page' => $s['page'], 'title' => $s['title'], 'boxes' => $s['boxes']);
    }, menu_sections($menu)),
);
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Разделы меню — <?= htmlspecialchars($menu['season']) ?></title>
<style>
  :root { --ink: #270d00; --paper: #fff; --table: #1c0a02; --spot: #d8187c; --line: #4a3329; --mute: #b7a69b; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--table); color: var(--paper); font: 14px/1.4 system-ui, sans-serif; display: grid; grid-template-columns: 150px minmax(0, 1fr) 340px; height: 100vh; }
  aside, main, section { overflow: auto; }
  button { font: inherit; cursor: pointer; }
  .pages { padding: 12px; display: grid; gap: 10px; align-content: start; border-right: 1px solid var(--line); }
  .pages button { background: none; border: 1px solid var(--line); color: var(--mute); padding: 6px; text-align: left; display: grid; gap: 4px; }
  .pages button[aria-current] { border-color: var(--paper); color: var(--paper); }
  .pages img { width: 100%; display: block; }
  main { padding: 16px; display: grid; justify-items: center; align-content: start; }
  .sheet { position: relative; width: min(100%, 760px); user-select: none; cursor: crosshair; touch-action: none; }
  .sheet img { display: block; width: 100%; pointer-events: none; }
  .box { position: absolute; border: 2px solid var(--spot); background: rgb(216 24 124 / .12); cursor: move; }
  .box.is-on { border-color: #1a73e8; background: rgb(26 115 232 / .18); }
  .box span { position: absolute; left: -2px; top: -22px; background: var(--spot); color: #fff; padding: 2px 6px; white-space: nowrap; font-size: 12px; pointer-events: none; }
  .box.is-on span { background: #1a73e8; }
  .handle { position: absolute; width: 14px; height: 14px; background: #1a73e8; border: 2px solid #fff; }
  .handle.tl { left: -8px; top: -8px; cursor: nwse-resize; }
  .handle.br { right: -8px; bottom: -8px; cursor: nwse-resize; }
  .box:not(.is-on) .handle { display: none; }
  .draft { position: absolute; border: 2px dashed #1a73e8; pointer-events: none; }
  section { border-left: 1px solid var(--line); padding: 16px; display: grid; gap: 14px; align-content: start; }
  h1 { font-size: 18px; margin: 0; }
  .help { color: var(--mute); margin: 0; }
  .list { display: grid; gap: 8px; }
  .item { border: 1px solid var(--line); padding: 8px; display: grid; gap: 6px; }
  .item.is-on { border-color: #1a73e8; }
  .item input { width: 100%; font: inherit; padding: 6px 8px; border: 1px solid var(--line); background: #2a1710; color: var(--paper); }
  .item .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .item .row button { background: none; border: 1px solid var(--line); color: var(--mute); padding: 4px 8px; }
  .save { background: var(--paper); color: var(--ink); border: 0; padding: 12px; font-weight: 600; }
  .status { min-height: 20px; color: var(--mute); }
  .status.is-error { color: #ff8a80; }
  .mode { color: #8ab4f8; }
</style>
</head>
<body>
<aside class="pages" id="pages"></aside>
<main><div class="sheet" id="sheet"><img id="img" alt=""></div></main>
<section>
  <h1>Разделы, <?= htmlspecialchars(mb_strtolower($menu['season'])) ?></h1>
  <p class="help">Обведите раздел мышью: от левого верхнего угла заголовка до последней цены. Рамку можно двигать и тянуть за синие углы. Порядок в списке — порядок чтения на телефоне. Раздел, который переходит в соседнюю колонку, — одна запись с двумя рамками.</p>
  <p class="help mode" id="mode" hidden>Обведите продолжение раздела — рамка добавится к нему. Esc — отмена.</p>
  <div class="list" id="list"></div>
  <button type="button" class="save" id="save">Сохранить в data/menu.php</button>
  <p class="status" id="status" role="status"></p>
</section>
<script>
const TOKEN = <?= json_encode($token) ?>;
const state = <?= json_encode($state, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;
const $ = (id) => document.getElementById(id);
const sheet = $('sheet'), img = $('img'), list = $('list');
let page = 1;
let selected = null;   // { s: раздел, b: номер рамки }
let addingTo = null;   // раздел, к которому добавляем ещё рамку
let dirty = false;
const round = (v) => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000;

function onPage() { return state.sections.filter((s) => s.page === page); }

function renderPages() {
  $('pages').innerHTML = state.pages.map((t, i) => {
    const n = i + 1, c = state.sections.filter((s) => s.page === n).length;
    return `<button type="button" data-n="${n}"${n === page ? ' aria-current="true"' : ''}><img src="/page/${n}" alt="" loading="lazy">${n}. ${t}<small>${c ? 'разделов: ' + c : 'не размечена'}</small></button>`;
  }).join('');
}

function renderBoxes() {
  sheet.querySelectorAll('.box').forEach((el) => el.remove());
  onPage().forEach((s) => s.boxes.forEach((b, i) => {
    const el = document.createElement('div');
    el.className = 'box' + (selected && selected.s === s && selected.b === i ? ' is-on' : '');
    Object.assign(el.style, { left: b[0] * 100 + '%', top: b[1] * 100 + '%', width: b[2] * 100 + '%', height: b[3] * 100 + '%' });
    el.innerHTML = `<span></span><i class="handle tl"></i><i class="handle br"></i>`;
    el.querySelector('span').textContent = (s.title || 'без названия') + (s.boxes.length > 1 ? ` (${i + 1})` : '');
    el._ref = { s, b: i };
    sheet.appendChild(el);
  }));
}

function renderList() {
  const secs = onPage();
  list.innerHTML = secs.length ? '' : '<p class="help">На этой странице разделов нет — на телефоне она покажется целиком.</p>';
  secs.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'item' + (selected && selected.s === s ? ' is-on' : '');
    item.innerHTML = `<input type="text" placeholder="Название, как на кнопке: «Супы»" maxlength="60">
      <div class="row"><button data-a="up">↑</button><button data-a="down">↓</button><button data-a="more">+ рамка</button>${s.boxes.length > 1 ? '<button data-a="last">− рамка</button>' : ''}<button data-a="del">Удалить</button></div>`;
    const input = item.querySelector('input');
    input.value = s.title;
    input.addEventListener('focus', () => { selected = { s, b: 0 }; renderBoxes(); markItems(); });
    input.addEventListener('input', () => { s.title = input.value; dirty = true; renderBoxes(); });
    item.querySelector('.row').addEventListener('click', (e) => {
      const a = e.target.dataset.a; if (!a) return;
      const all = state.sections, i = all.indexOf(s);
      const same = all.map((x, k) => x.page === page ? k : -1).filter((k) => k >= 0);
      const pos = same.indexOf(i);
      if (a === 'up' && pos > 0) { [all[i], all[same[pos - 1]]] = [all[same[pos - 1]], all[i]]; }
      if (a === 'down' && pos < same.length - 1) { [all[i], all[same[pos + 1]]] = [all[same[pos + 1]], all[i]]; }
      if (a === 'del') { all.splice(i, 1); selected = null; }
      if (a === 'last') { s.boxes.pop(); selected = null; }
      if (a === 'more') { addingTo = s; $('mode').hidden = false; return; }
      dirty = true; render();
    });
    item._s = s;
    list.appendChild(item);
  });
}

function markItems() { list.querySelectorAll('.item').forEach((it) => it.classList.toggle('is-on', !!selected && selected.s === it._s)); }
function render() { renderPages(); renderBoxes(); renderList(); }

function show(n) { page = n; selected = null; addingTo = null; $('mode').hidden = true; img.src = '/page/' + n; render(); }

$('pages').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(Number(b.dataset.n)); });

// Мышь: обвести новую рамку, подвинуть рамку или потянуть её за угол
function point(e) {
  const r = sheet.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
let drag = null;
sheet.addEventListener('pointerdown', (e) => {
  sheet.setPointerCapture(e.pointerId);
  const p = point(e), box = e.target.closest('.box');
  if (box) {
    selected = box._ref;
    const b = selected.s.boxes[selected.b].slice();
    drag = { kind: e.target.classList.contains('tl') ? 'tl' : e.target.classList.contains('br') ? 'br' : 'move', start: p, orig: b };
    renderBoxes(); markItems();
    return;
  }
  const el = document.createElement('div'); el.className = 'draft'; sheet.appendChild(el);
  drag = { kind: 'new', start: p, el };
});
sheet.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = point(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (drag.kind === 'new') {
    Object.assign(drag.el.style, { left: Math.min(p.x, drag.start.x) * 100 + '%', top: Math.min(p.y, drag.start.y) * 100 + '%', width: Math.abs(dx) * 100 + '%', height: Math.abs(dy) * 100 + '%' });
    return;
  }
  let [x, y, w, h] = drag.orig;
  if (drag.kind === 'move') { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - h, Math.max(0, y + dy)); }
  if (drag.kind === 'br') { w = Math.max(.02, w + dx); h = Math.max(.02, h + dy); }
  if (drag.kind === 'tl') { const nx = Math.min(x + w - .02, x + dx), ny = Math.min(y + h - .02, y + dy); w += x - nx; h += y - ny; x = nx; y = ny; }
  selected.s.boxes[selected.b] = [round(x), round(y), round(Math.min(w, 1 - x)), round(Math.min(h, 1 - y))];
  dirty = true; renderBoxes();
});
sheet.addEventListener('pointerup', (e) => {
  if (!drag) return;
  if (drag.kind === 'new') {
    drag.el.remove();
    const p = point(e);
    const b = [round(Math.min(p.x, drag.start.x)), round(Math.min(p.y, drag.start.y)), round(Math.abs(p.x - drag.start.x)), round(Math.abs(p.y - drag.start.y))];
    if (b[2] > .02 && b[3] > .02) {
      if (addingTo) {
        addingTo.boxes.push(b); selected = { s: addingTo, b: addingTo.boxes.length - 1 };
        addingTo = null; $('mode').hidden = true;
      } else {
        const s = { page, title: '', boxes: [b] };
        // Новый раздел — после последнего раздела этой страницы
        const last = state.sections.map((x, k) => x.page <= page ? k : -1).filter((k) => k >= 0).pop();
        state.sections.splice(last === undefined ? 0 : last + 1, 0, s);
        selected = { s, b: 0 };
      }
      dirty = true; render();
      const input = [...list.querySelectorAll('.item')].find((it) => it._s === selected.s)?.querySelector('input');
      if (input && !selected.s.title) input.focus();
    }
  }
  drag = null;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { addingTo = null; $('mode').hidden = true; selected = null; renderBoxes(); markItems(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected && document.activeElement.tagName !== 'INPUT') {
    const s = selected.s;
    s.boxes.splice(selected.b, 1);
    if (!s.boxes.length) state.sections.splice(state.sections.indexOf(s), 1);
    selected = null; dirty = true; render();
  }
});

$('save').addEventListener('click', async () => {
  const st = $('status');
  const untitled = state.sections.filter((s) => !s.title.trim());
  if (untitled.length) {
    st.className = 'status is-error';
    st.textContent = `Без названия: ${untitled.length} (страница ${untitled[0].page}). Впишите название или удалите рамку.`;
    show(untitled[0].page);
    return;
  }
  st.className = 'status'; st.textContent = 'Сохраняю…';
  try {
    const res = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': TOKEN }, body: JSON.stringify({ sections: state.sections }) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'Ошибка ' + res.status);
    dirty = false;
    st.textContent = `Сохранено разделов: ${out.saved}. Обновите страницу меню на сайте, чтобы увидеть.`;
  } catch (err) {
    st.className = 'status is-error'; st.textContent = err.message;
  }
});
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); } });

show(1);
</script>
</body>
</html>
