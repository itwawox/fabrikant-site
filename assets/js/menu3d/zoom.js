// Окно увеличения для меню: страница меню открывается поверх сайта в <dialog>, и её мелкий текст
// можно рассмотреть на телефоне. Щипок двумя пальцами, двойное нажатие и кнопки ± меняют масштаб,
// увеличенную страницу двигают пальцем или мышью, неувеличенную листают свайпом. Закрывают Esc,
// кнопкой и «Назад» — для этого при открытии в историю кладётся запись.
// Окно открывается сразу в масштабе для чтения и в том месте страницы, куда нажали: гость нажимал,
// чтобы прочитать, и вписанная целиком страница выглядела бы так же мелко, как до нажатия.

const MAX = 4;
// Ширина листа на экране при открытии, в CSS-пикселях: шрифт цен тогда около 15 px.
// На телефоне это примерно ×2,5, на ПК, где лист вписан по высоте, — около ×1,9
const READ_WIDTH = 1000;
// С какого масштаба грузить копию для увеличения (3200 px): обычная (1600 px) на телефоне
// с плотным экраном начинает расплываться уже при ×1,5
const SHARP_FROM = 1.3;
// Во сколько раз меняет масштаб одно нажатие «+» или «−» и двойное нажатие
const STEP = 1.6;
const DOUBLE = 2.5;
// Свайп: на сколько пикселей сдвинуть палец по горизонтали, чтобы перелистнуть
const SWIPE = 60;

/**
 * Масштаб и сдвиг для чтения: лист шириной READ_WIDTH (но не больше max), а точка листа at
 * (доли ширины и высоты, 0…1) остаётся на экране там же, где была бы на вписанной странице.
 * f — где лежит вписанная страница (см. fit() ниже). Сдвиг потом ещё ограничит render().
 */
export function readingView(f, at, max = MAX) {
    const scale = Math.min(max, Math.max(1, READ_WIDTH / f.fw));
    const px = f.ox + at.x * f.fw;
    const py = f.oy + at.y * f.fh;
    return { scale, x: px * (1 - scale), y: py * (1 - scale) };
}

/**
 * Связывает окно с меню. src(n, size) — адрес картинки страницы ('low' или 'high'),
 * onPage(n) — окно перелистнули. src(n, 'zoom') — копия для увеличения, её грузим только при увеличении.
 * Возвращает open(n, at) и destroy(): at — куда нажали на странице (доли 0…1), без него — левый верхний угол.
 */
export function createZoom(dialog, { pages, src, onPage }) {
    const find = (name) => dialog.querySelector('.menu-zoom__' + name);
    const stage = find('stage');
    const img = find('img');
    const count = find('count');
    const prev = find('prev');
    const next = find('next');
    const zoomIn = find('in');
    const zoomOut = find('out');
    const listeners = new AbortController();
    const on = (target, type, handler, extra) => target.addEventListener(type, handler, { signal: listeners.signal, ...extra });

    let page = 1;
    // Масштаб и сдвиг картинки в пикселях окна; картинка вписана в окно целиком при scale = 1
    let scale = 1;
    let x = 0;
    let y = 0;
    const pointers = new Map();
    let gesture = null;
    let lastTap = null;
    // Какая копия страницы уже на экране: 0 — лёгкая, 1 — обычная, 2 — для увеличения.
    // Копия похуже, догрузившаяся позже, лучшую не заменяет
    let level = 0;
    let sharpAsked = 0;

    // Где внутри окна лежит вписанная картинка (object-fit: contain): отступы и размер при масштабе 1
    function fit() {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const ratio = (img.naturalHeight || 2263) / (img.naturalWidth || 1600);
        const fw = Math.min(w, h / ratio);
        const fh = fw * ratio;
        return { w, h, fw, fh, ox: (w - fw) / 2, oy: (h - fh) / 2 };
    }

    // Увеличенная страница не уезжает за края окна, а меньшая, чем окно, стоит по центру
    function clampAxis(pos, size, content, offset) {
        const span = content * scale;
        if (span <= size) {
            return (size - span) / 2 - offset * scale;
        }
        return Math.min(-offset * scale, Math.max(size - (offset + content) * scale, pos));
    }

    function render(animate) {
        const f = fit();
        x = clampAxis(x, f.w, f.fw, f.ox);
        y = clampAxis(y, f.h, f.fh, f.oy);
        img.classList.toggle('is-animating', Boolean(animate));
        img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        stage.classList.toggle('is-zoomed', scale > 1.001);
        zoomOut.disabled = scale <= 1.001;
        zoomIn.disabled = scale >= MAX - 0.001;
        if (scale >= SHARP_FROM) {
            sharpen();
        }
    }

    // Поставить копию страницы n уровня lvl, когда она загрузится, если её ещё ждут
    function load(n, size, lvl) {
        const full = new Image();
        full.onload = () => {
            if (page === n && level < lvl) {
                level = lvl;
                img.src = full.src;
            }
        };
        full.src = src(n, size);
    }

    function sharpen() {
        if (sharpAsked !== page) {
            sharpAsked = page;
            load(page, 'zoom', 2);
        }
    }

    /** Масштаб to, точка (px, py) окна остаётся под пальцем или курсором. */
    function zoomAt(to, px, py, animate) {
        const target = Math.min(MAX, Math.max(1, to));
        x = px - (px - x) * (target / scale);
        y = py - (py - y) * (target / scale);
        scale = target;
        render(animate);
    }

    function zoomCenter(to) {
        zoomAt(to, stage.clientWidth / 2, stage.clientHeight / 2, true);
    }

    function point(event) {
        const rect = stage.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    // at — открыть страницу сразу для чтения, с этой точкой на месте; без него — вписанной целиком
    function show(n, at) {
        page = Math.min(pages, Math.max(1, n));
        level = 0;
        // Сначала лёгкая копия — она обычно уже в кэше после меню на странице, затем полная.
        // Пока полная грузилась, могли перелистнуть — тогда она уже не нужна
        img.src = src(page, 'low');
        load(page, 'high', 1);
        if (at) {
            ({ scale, x, y } = readingView(fit(), at));
        } else {
            scale = 1;
            x = y = 0;
        }
        img.alt = 'Страница ' + page + ' из ' + pages;
        const text = page + ' / ' + pages;
        if (count.textContent !== text) {
            count.textContent = text;
        }
        prev.disabled = page === 1;
        next.disabled = page === pages;
        render(false);
        onPage(page);
    }

    // Увеличенную страницу перелистывают на следующую тоже увеличенной, с начала — левого верхнего угла
    function step(delta) {
        if (page + delta >= 1 && page + delta <= pages) {
            show(page + delta, scale > 1.001 ? { x: 0, y: 0 } : null);
        }
    }

    function open(n, at) {
        // Окно открываем до расчёта масштаба: у закрытого нет размеров
        if (!dialog.open) {
            dialog.showModal();
            document.documentElement.classList.add('book-lock');
            history.pushState({ menuZoom: 1 }, '', location.href);
        }
        show(n, at || { x: 0, y: 0 });
    }

    // Страницу под окном отпускаем сразу, не дожидаясь события close: браузер может его задержать
    function cleanup() {
        document.documentElement.classList.remove('book-lock');
        pointers.clear();
        gesture = null;
    }

    function close() {
        if (dialog.open) {
            dialog.close();
        }
        cleanup();
    }

    // Закрытие своей кнопкой или Esc: убираем запись истории, окно закроет обработчик popstate
    function requestClose() {
        if (history.state && history.state.menuZoom) {
            history.back();
        } else {
            close();
        }
    }

    on(window, 'popstate', close);
    on(dialog, 'close', cleanup);
    on(dialog, 'cancel', (event) => {
        event.preventDefault();
        requestClose();
    });
    on(find('close'), 'click', requestClose);
    on(prev, 'click', () => step(-1));
    on(next, 'click', () => step(1));
    on(zoomIn, 'click', () => zoomCenter(scale * STEP));
    on(zoomOut, 'click', () => zoomCenter(scale / STEP < 1.05 ? 1 : scale / STEP));
    on(dialog, 'keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(event.key === 'ArrowLeft' ? -1 : 1);
        } else if (event.key === '+' || event.key === '=') {
            zoomCenter(scale * STEP);
        } else if (event.key === '-') {
            zoomCenter(scale / STEP < 1.05 ? 1 : scale / STEP);
        } else if (event.key === '0') {
            zoomCenter(1);
        }
    });
    on(window, 'resize', () => dialog.open && render(false));

    // --- Жесты ---

    on(stage, 'pointerdown', (event) => {
        stage.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, point(event));
        const pts = Array.from(pointers.values());
        if (pts.length === 2) {
            const [a, b] = pts;
            gesture = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        } else if (pts.length === 1) {
            gesture = { type: 'drag', start: pts[0], last: pts[0], moved: false };
        }
    });

    on(stage, 'pointermove', (event) => {
        if (!pointers.has(event.pointerId) || !gesture) {
            return;
        }
        const p = point(event);
        pointers.set(event.pointerId, p);
        if (gesture.type === 'pinch' && pointers.size === 2) {
            const [a, b] = Array.from(pointers.values());
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            x += mid.x - gesture.mid.x;
            y += mid.y - gesture.mid.y;
            zoomAt(scale * dist / gesture.dist, mid.x, mid.y, false);
            gesture.dist = dist;
            gesture.mid = mid;
        } else if (gesture.type === 'drag') {
            if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 6) {
                gesture.moved = true;
            }
            if (scale > 1.001) {
                x += p.x - gesture.last.x;
                y += p.y - gesture.last.y;
                render(false);
            }
            gesture.last = p;
        }
    });

    function release(event) {
        if (!pointers.delete(event.pointerId) || !gesture) {
            return;
        }
        if (gesture.type === 'drag' && event.type === 'pointerup') {
            const p = point(event);
            const dx = p.x - gesture.start.x;
            const dy = p.y - gesture.start.y;
            if (scale <= 1.001 && Math.abs(dx) > SWIPE && Math.abs(dx) > 1.5 * Math.abs(dy)) {
                step(dx < 0 ? 1 : -1);
            } else if (!gesture.moved) {
                // Двойное нажатие: приблизить к точке или вернуть всю страницу
                const now = event.timeStamp;
                if (lastTap && now - lastTap.time < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
                    zoomAt(scale > 1.001 ? 1 : DOUBLE, p.x, p.y, true);
                    lastTap = null;
                } else {
                    lastTap = { time: now, x: p.x, y: p.y };
                }
            }
        }
        // Из щипка остался один палец — дальше он двигает страницу
        const rest = Array.from(pointers.values());
        gesture = rest.length === 1 ? { type: 'drag', start: rest[0], last: rest[0], moved: true } : null;
    }
    on(stage, 'pointerup', release);
    on(stage, 'pointercancel', release);

    // Колесо: с Ctrl (и щипок на тачпаде) — масштаб, без него у увеличенной страницы — сдвиг
    on(stage, 'wheel', (event) => {
        event.preventDefault();
        const p = point(event);
        if (event.ctrlKey) {
            zoomAt(scale * Math.exp(-event.deltaY / 100), p.x, p.y, false);
        } else if (scale > 1.001) {
            x -= event.deltaX;
            y -= event.deltaY;
            render(false);
        }
    }, { passive: false });

    return {
        open,
        destroy() {
            listeners.abort();
            close();
        },
    };
}
