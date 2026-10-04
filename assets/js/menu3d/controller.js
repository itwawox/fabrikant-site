// Управление газетой: указатель (мышь, палец, перо), колесо и клавиатура.
// Сам ничего не рисует — переводит жесты в команды книге (host из book.js).

const DRAG_START = 6;
const TAP_GAP = 300;
const TAP_REACH = 30;

/** Вешает обработчики на сцену и холст. host — команды книги. Возвращает { dispose() }. */
export function createController(stage, canvas, host) {
    const pointers = new Map();
    const hover = matchMedia('(hover: hover)').matches;
    const off = new AbortController();
    const on = (target, type, handler, passive = true) => target.addEventListener(type, handler, { signal: off.signal, passive });
    // idle → press → drag (лист в руке) | pan (сдвиг вида) | slide (смахивание в режиме одной страницы) | pinch
    let mode = 'idle';
    let start = null;
    let lastTap = null;
    let pinch = null;

    function spread() {
        const [a, b] = [...pointers.values()];
        return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function down(event) {
        if (event.button !== 0 || pointers.size > 1) {
            return;
        }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        try {
            canvas.setPointerCapture(event.pointerId);
        } catch (error) {
            // Указатель уже отпущен — жест просто не начнётся
        }
        if (pointers.size === 2) {
            // Второй палец: лист отпускаем, дальше только зум
            host.drop(true);
            mode = 'pinch';
            pinch = { d: spread().d, zoom: host.state().zoom };
            return;
        }
        mode = 'press';
        start = { x: event.clientX, y: event.clientY, probe: host.probe(event.clientX, event.clientY) };
    }

    function move(event) {
        const point = pointers.get(event.pointerId);
        if (!point) {
            // Мышь без нажатия: у внешнего угла страницы лист чуть отгибается
            if (hover && event.pointerType === 'mouse' && mode === 'idle') {
                const probe = host.probe(event.clientX, event.clientY);
                host.peel(probe.corner ? probe : null);
                canvas.style.cursor = host.state().zoom > 1 ? 'grab' : probe.zone ? 'pointer' : probe.leaf >= 0 ? 'grab' : '';
            }
            return;
        }
        const dx = event.clientX - point.x;
        const dy = event.clientY - point.y;
        if (mode === 'press' && Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_START) {
            const state = host.state();
            const side = start.probe.side;
            if (state.zoom > 1) {
                mode = 'pan';
            } else if (state.single && (event.clientX - start.x) * side > 0) {
                // Одна страница на экране: потянули «не в ту сторону» — это переход к соседней странице разворота
                mode = 'slide';
            } else {
                mode = host.grab(start.probe) ? 'drag' : 'none';
            }
            canvas.style.cursor = mode === 'none' ? '' : 'grabbing';
        }
        point.x = event.clientX;
        point.y = event.clientY;
        if (mode === 'drag') {
            host.drag(event.clientX, event.clientY);
        } else if (mode === 'pan') {
            host.pan(dx, dy);
        } else if (mode === 'pinch' && pointers.size === 2) {
            const now = spread();
            host.zoomTo(pinch.zoom * now.d / pinch.d, now.x, now.y, true);
        }
    }

    function up(event) {
        if (!pointers.delete(event.pointerId)) {
            return;
        }
        const was = mode;
        // После зума двумя пальцами оставшийся палец двигает вид
        mode = pointers.size ? 'pan' : 'idle';
        canvas.style.cursor = '';
        if (was === 'drag') {
            host.drop(event.type !== 'pointerup');
        } else if (was === 'slide' && event.type === 'pointerup' && Math.abs(event.clientX - start.x) > 40) {
            // Смахнули вправо — к предыдущей странице, влево — к следующей
            (event.clientX > start.x ? host.prev : host.next)();
        } else if (was === 'press' && event.type === 'pointerup') {
            tap(event);
        }
    }

    function tap(event) {
        const zoomed = host.state().zoom > 1;
        const near = lastTap && event.timeStamp - lastTap.time < TAP_GAP
            && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < TAP_REACH;
        if (near) {
            lastTap = null;
            host.toggleZoom(event.clientX, event.clientY);
        } else if (start.probe.zone && !zoomed) {
            // Внешняя треть страницы листает сразу; двойное нажатие там — два листа, а не зум
            (start.probe.zone > 0 ? host.next : host.prev)();
        } else {
            lastTap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
        }
    }

    function wheel(event) {
        const state = host.state();
        // Обычное колесо прокручивает страницу сайта. Зум — только щипком на тачпаде (ctrlKey),
        // когда газета уже приближена, или на весь экран.
        if (!event.ctrlKey && state.zoom <= 1 && !state.immersive) {
            return;
        }
        event.preventDefault();
        const lines = event.deltaMode === 1 ? 16 : 1;
        const factor = Math.exp(-event.deltaY * lines * (event.ctrlKey ? 0.012 : 0.0025));
        host.zoomTo(state.zoom * factor, event.clientX, event.clientY);
    }

    function key(event) {
        if (event.target !== stage || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        const state = host.state();
        const actions = {
            ArrowRight: host.next,
            PageDown: host.next,
            ArrowLeft: host.prev,
            PageUp: host.prev,
            Home: host.first,
            End: host.last,
            '+': () => host.zoomTo(state.zoom * 1.4),
            '=': () => host.zoomTo(state.zoom * 1.4),
            '-': () => host.zoomTo(state.zoom / 1.4),
            0: host.resetView,
            // Esc без зума не трогаем — им выходят из полноэкранного режима
            Escape: state.zoom > 1 ? host.resetView : null,
        };
        const action = actions[event.key];
        if (action) {
            event.preventDefault();
            action();
        }
    }

    on(canvas, 'pointerdown', down);
    on(canvas, 'pointermove', move);
    on(canvas, 'pointerup', up);
    // Браузер забрал жест себе (вертикальная прокрутка пальцем) или отнял захват
    on(canvas, 'pointercancel', up);
    on(canvas, 'lostpointercapture', up);
    on(canvas, 'pointerleave', () => pointers.size || host.peel(null));
    on(canvas, 'wheel', wheel, false);
    on(stage, 'keydown', key, false);

    return {
        dispose() {
            off.abort();
        },
    };
}
