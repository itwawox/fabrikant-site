// Газета-меню в 3D: собирает сцену, листы, текстуры и управление, отдаёт наружу простой API.
// Здесь живёт состояние: какой лист куда летит, куда смотрит камера, какой зум.
import { FOV, createStage } from './stage.js';
import { createLeaf } from './leaf.js';
import { smooth, solveTurn, stackZ, orderTurns } from './bend.js';
import { stepSpring } from './spring.js';
import { createTextures } from './textures.js';
import { createController } from './controller.js';

const TAN = Math.tan(FOV * Math.PI / 360);
const TILT = 10 * Math.PI / 180;
// Поля вокруг газеты при полном виде. Запас нужен листу в полёте: он поднимается к зрителю,
// в перспективе становится крупнее и при малых полях обрезался верхним краем сцены.
const MARGIN = 1.13;
// По той же причине газета лежит чуть ниже середины сцены (в долях ширины страницы)
const HEADROOM = 0.04;
// Зазор между листами в стопке, в долях ширины страницы
const DELTA = 0.0015;
// Насколько отгибается угол под курсором — подсказка «здесь можно листать»
const PEEL = 0.045;
// Жёсткость пружин: полёт листа и камеры; лист в руке (почти без отставания)
const TURN = 7;
const FOLLOW = 40;
// Лист с кнопки переворачивается так, будто его взяли за нижний угол
const CORNER = 0.12;
// Шире этого (в пикселях экрана) страница получает картинку 1600 px
const HIGH_PX = 1100;
// Сколько памяти видеокарты телефона отдаём под страницы малого размера (1000 px, ~7,5 МБ каждая).
// Меню из 8 страниц помещается целиком, и при быстром листании ни один лист не ждёт загрузки;
// у меню толще — держим ближайшие к открытому развороту, но не меньше трёх разворотов.
const LITE_BUDGET = 64 * 1024 * 1024;
const LOW_WIDTH = 1000;

const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const round = (x) => Math.round(x * 1000) / 1000;

/**
 * Строит газету внутри stage и возвращает управление ею, когда первый кадр уже на экране.
 * Отклоняется, если WebGL не запустился. Параметры и методы описаны в contracts.md (B.2).
 */
export async function createBook(el, options) {
    const pages = options.pages;
    const count = Math.ceil(pages / 2);
    const H = options.pageRatio;
    // Телефон: памяти мало — держим меньше текстур и карту теней поменьше
    const lite = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
    const lowCap = lite ? Math.max(6, Math.floor(LITE_BUDGET / (LOW_WIDTH * LOW_WIDTH * H * 4 * 4 / 3))) : pages;

    const stage = createStage(el, H, lite, { frame, resize, restore, fail, hide: () => textures.dropHigh() });
    const textures = createTextures(stage.renderer, options, stage.invalidate, swap, () => fail('texture'));
    // Лист: x — поворот 0…1, v — скорость, target — куда тянет пружина; to — на какой стопке
    // он должен оказаться; back — гнётся зеркально (его возвращают слева); vGrab — за какую высоту взят
    const leaves = [];
    for (let i = 0; i < count; i++) {
        const leaf = createLeaf(H, textures.blank);
        stage.scene.add(leaf.meshes[0], leaf.meshes[1]);
        leaves.push({ leaf, x: 0, v: 0, target: 0, to: 0, peel: 0, back: false, vGrab: CORNER, grab: CORNER, hold: null });
    }

    const cam = { x: 0.5, v: 0, target: 0.5 };
    // Зум хранится логарифмом: тогда приближение и отдаление идут с одной скоростью
    const zoom = { x: 0, v: 0, target: 0 };
    const pan = { x: 0, y: 0 };
    let anchor = null;
    let single = false;
    let dFit = 1;
    let pagePx = 0;
    let zoomMax = 2;
    let goal = 0;
    let active = 1;
    let held = -1;
    let follow = 0;
    let grabU = 1;
    let grabShift = 0;
    let immersive = false;
    let wasMoving = false;
    let sent = '';
    let planned = -1;
    let dead = false;
    let failed = false;
    let first = null;

    // --- Камера ---

    function pose() {
        const d = dFit / Math.exp(zoom.x);
        // При чтении вблизи наклон мешает — выпрямляем взгляд
        const phi = TILT * (1 - smooth((Math.exp(zoom.x) - 1) * 2));
        // Наклон сдвигает газету в кадре вверх; поправка возвращает её в середину
        // Запас сверху нужен только при полном виде; вблизи он уходит вместе с наклоном
        return { x: cam.x + pan.x, y: pan.y + HEADROOM * phi / TILT - Math.sin(phi) * H * H / (4 * d), d, phi };
    }

    function ndc(clientX, clientY) {
        const rect = stage.canvas.getBoundingClientRect();
        return [(clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2];
    }

    // Куда луч из точки экрана попадает на стол; slope — сдвиг луча по x на единицу высоты
    function ray(nx, ny) {
        const p = pose();
        const dx = nx * TAN * stage.size.w / stage.size.h;
        const dy = Math.cos(p.phi) * ny * TAN + Math.sin(p.phi);
        const dz = Math.sin(p.phi) * ny * TAN - Math.cos(p.phi);
        const s = -p.d * Math.cos(p.phi) / dz;
        return { x: p.x + s * dx, y: p.y - p.d * Math.sin(p.phi) + s * dy, slope: dx / dz };
    }

    // Сдвиг вида не выпускает газету из кадра; при полном виде сдвига нет вовсе
    function clampPan() {
        const half = dFit / Math.exp(zoom.x) * TAN;
        const mx = Math.max(0, (single ? 0.5 : 1) + 0.04 - half * stage.size.w / stage.size.h);
        const my = Math.max(0, H / 2 + 0.04 - half);
        pan.x = clamp(pan.x, -mx, mx);
        pan.y = clamp(pan.y, -my, my);
    }

    // Одна страница — камера на ней; разворот — на корешке; закрытая газета — на обложке
    function camGoal() {
        if (single) {
            return active % 2 ? 0.5 : -0.5;
        }
        return goal === 0 ? 0.5 : goal === count ? -0.5 : 0;
    }

    function resize() {
        const aspect = stage.size.w / stage.size.h;
        const was = single;
        // В узком окне (телефон в портрете) разворот не читается — показываем по одной странице
        single = aspect < 1;
        dFit = Math.max(H / (2 * TAN), (single ? 1 : 2) / (2 * TAN * aspect)) * MARGIN;
        pagePx = stage.size.h / (2 * TAN * dFit);
        // Предел зума — пока картинка 1600 px не начнёт расплываться
        zoomMax = clamp(1600 / pagePx, 1.5, 4);
        zoom.target = Math.min(zoom.target, Math.log(zoomMax));
        zoom.x = Math.min(zoom.x, Math.log(zoomMax));
        if (single !== was) {
            active = single ? active : goal ? 2 * goal : 1;
            cam.x = cam.target = camGoal();
            cam.v = 0;
        }
        clampPan();
        plan();
        emit();
    }

    // --- Состояние для панели ---

    function state() {
        const left = goal > 0 ? 2 * goal : null;
        const right = 2 * goal < pages ? 2 * goal + 1 : null;
        return {
            pages,
            leaves: count,
            turned: goal,
            visible: [left, right],
            single,
            active: single ? active : left || right,
            canPrev: single ? active > 1 : goal > 0,
            canNext: single ? active < pages : goal < count,
            zoom: round(Math.exp(zoom.target)),
            zoomMax: round(zoomMax),
            immersive,
        };
    }

    function emit() {
        const now = state();
        const key = JSON.stringify(now);
        if (key === sent || dead) {
            return;
        }
        sent = key;
        // При полном виде вертикальный жест пальцем прокручивает страницу сайта, как обычно
        stage.canvas.style.touchAction = now.zoom > 1 || immersive ? 'none' : 'pan-y';
        if (options.onChange) {
            options.onChange(now);
        }
    }

    function label() {
        const [left, right] = state().visible;
        const text = !single && left && right
            ? 'Меню, страницы ' + left + ' и ' + right
            : 'Меню, страница ' + (single ? active : left || right);
        stage.canvas.setAttribute('aria-label', text + ' из ' + pages);
    }

    function fail(reason) {
        if (!failed && !dead) {
            failed = true;
            if (options.onFail) {
                options.onFail(reason);
            }
        }
    }

    // --- Текстуры ---

    // Очерёдность загрузки: текущий разворот, следующий, предыдущий, через один вперёд и назад…
    // На телефоне — столько страниц, сколько влезает в LITE_BUDGET (lowCap)
    function plan() {
        const spread = (g) => [2 * g, 2 * g + 1].filter((page) => page >= 1 && page <= pages);
        const low = [];
        for (let d = 0; d <= count && low.length < lowCap; d++) {
            spread(goal + d).concat(d ? spread(goal - d) : []).forEach((page) => {
                if (low.length < lowCap) {
                    low.push(page);
                }
            });
        }
        const now = state();
        let high = [];
        if (pagePx * now.zoom * stage.size.ratio > HIGH_PX) {
            high = single ? [active] : now.visible.filter(Boolean);
            if (lite && high.length > 1) {
                high = [high[cam.x + pan.x < 0 ? 0 : 1]];
            }
        }
        textures.need(low, high);
        // Перелистнули — большие картинки прежнего разворота больше не нужны
        if (planned !== goal) {
            planned = goal;
            textures.dropHigh(high);
        }
    }

    function swap(page) {
        if (dead) {
            return;
        }
        leaves[(page - 1) >> 1].leaf.setMap((page - 1) & 1, textures.get(page));
        stage.invalidate();
        if (first && page === state().active) {
            first();
        }
    }

    function restore() {
        textures.reload();
        leaves.forEach((item) => item.leaf.reset());
    }

    // --- Кадр ---

    // Лист отрывается от стопки: с какой стороны он лежал, в ту сторону и будет гнуться
    function rouse(item) {
        const resting = item.x === 0 || item.x === 1;
        if (resting) {
            item.back = item.x === 1;
        }
        return resting;
    }

    function lift(item, to) {
        if (rouse(item)) {
            item.vGrab = item.grab = CORNER;
        }
        item.to = to;
        item.peel = 0;
    }

    function frame(dt) {
        if (dead) {
            return false;
        }
        let moving = false;
        // Быстрые нажатия: следующий лист стартует, когда предыдущий ушёл на четверть пути.
        // При зуме камера слишком близко к бумаге — сначала отъезжаем.
        if (held < 0) {
            const calm = Math.exp(zoom.x) < 1.2;
            for (let i = 0; i < goal; i++) {
                if (!leaves[i].to) {
                    if (calm && (i === 0 || leaves[i - 1].x > 0.25)) {
                        lift(leaves[i], 1);
                    }
                    moving = true;
                }
            }
            for (let i = count - 1; i >= goal; i--) {
                if (leaves[i].to) {
                    if (calm && (i === count - 1 || leaves[i + 1].x < 0.75)) {
                        lift(leaves[i], 0);
                    }
                    moving = true;
                }
            }
        }
        leaves.forEach((item, i) => {
            if (item.hold !== null) {
                item.x = item.hold;
                item.v = 0;
                return;
            }
            const resting = item.x === 0 || item.x === 1;
            item.target = i === held ? follow : item.to ? 1 - item.peel : item.peel;
            if (stepSpring(item, dt, i === held ? FOLLOW : item.peel ? 2 * TURN : TURN)) {
                moving = true;
            }
            if (item.x <= 0 || item.x >= 1) {
                item.x = item.x <= 0 ? 0 : 1;
                item.v = 0;
            }
            // Перехват на лету: точка захвата переезжает плавно, иначе лист дёрнется
            const gap = item.grab - item.vGrab;
            if (resting || Math.abs(gap) < 0.004) {
                item.vGrab = item.grab;
            } else {
                item.vGrab += gap * Math.min(1, dt * 12);
                moving = true;
            }
        });
        orderTurns(leaves, held);

        moving = stepSpring(cam, dt, TURN) || moving;
        moving = stepSpring(zoom, dt, 12) || moving;
        if (anchor) {
            // Точка под курсором остаётся под курсором, пока меняется зум
            for (let n = 0; n < 2; n++) {
                const p = ray(anchor.nx, anchor.ny);
                pan.x += anchor.x - p.x;
                pan.y += anchor.y - p.y;
            }
            if (zoom.x === zoom.target) {
                anchor = null;
            }
        }
        clampPan();

        let shadows = false;
        leaves.forEach((item, i) => {
            const flying = item.x > 0 && item.x < 1;
            // Тень в корешке есть только там, где рядом лежит соседняя страница
            const gutters = [
                i ? smooth(leaves[i - 1].x) : 0,
                i < count - 1 ? 1 - smooth(leaves[i + 1].x) : 0,
            ];
            const bent = item.leaf.update(item.x, { z: stackZ(i, count, item.x, DELTA, item.back), vGrab: item.vGrab, back: item.back }, gutters);
            shadows = item.leaf.cast(flying) || (bent && flying) || shadows;
        });
        const p = pose();
        stage.view(p.x, p.y, p.d, p.phi);
        stage.shade(smooth(leaves[0].x), 1 - smooth(leaves[count - 1].x));
        // Выгрузка картинки в видеокарту — заметная пауза, поэтому во время перетаскивания только миниатюры
        if (textures.flush(held >= 0)) {
            moving = true;
        }
        stage.render(shadows);

        if (wasMoving && !moving) {
            label();
            plan();
        }
        wasMoving = moving;
        emit();
        return moving;
    }

    // --- Действия ---

    function turned() {
        return leaves.filter((item) => item.to).length;
    }

    function wake() {
        cam.target = camGoal();
        wasMoving = true;
        stage.invalidate();
        emit();
    }

    function resetView() {
        zoom.target = 0;
        anchor = null;
        plan();
        wake();
    }

    function go(step, page) {
        const before = goal;
        if (single || page) {
            active = clamp(page || active + step, 1, pages);
            goal = Math.floor(active / 2);
        } else {
            goal = clamp(goal + step, 0, count);
            active = goal ? 2 * goal : 1;
        }
        leaves.forEach((item) => {
            item.peel = 0;
        });
        if (goal !== before && zoom.target > 0) {
            zoom.target = 0;
            anchor = null;
        }
        // Картинки нового разворота заказываем сразу, а не когда лист ляжет: при быстром листании
        // он не ложится, и листы прилетали белыми
        if (goal !== before) {
            plan();
        }
        wake();
    }

    function zoomTo(z, clientX, clientY, instant) {
        anchor = null;
        if (clientX !== undefined) {
            // Запоминаем точку стола под курсором при нынешнем зуме — она останется на месте
            const [nx, ny] = ndc(clientX, clientY);
            const p = ray(nx, ny);
            anchor = { nx, ny, x: p.x, y: p.y };
        }
        zoom.target = Math.log(clamp(z, 1, zoomMax));
        if (instant) {
            zoom.x = zoom.target;
            zoom.v = 0;
        }
        plan();
        wake();
    }

    // Что под указателем: страница, лист, который с неё можно взять, и зона нажатия
    function probe(clientX, clientY) {
        const [nx, ny] = ndc(clientX, clientY);
        const p = ray(nx, ny);
        const side = p.x > 0 ? 1 : -1;
        const u = Math.abs(p.x);
        const v = p.y / H + 0.5;
        const index = turned() - (side > 0 ? 0 : 1);
        const on = u <= 1 && v >= 0 && v <= 1 && index >= 0 && index < count;
        // Доля ширины страницы слева направо: внешняя треть листает
        const across = side > 0 ? u : 1 - u;
        const zone = !on ? 0
            : across > 2 / 3 && (single || side > 0) ? 1
                : across < 1 / 3 && (single || side < 0) ? -1 : 0;
        return { x: p.x, side, u, v, leaf: on ? index : -1, zone, corner: on && u > 0.8 && Math.abs(v - 0.5) > 0.32 };
    }

    const host = {
        state,
        probe,
        next: () => go(1),
        prev: () => go(-1),
        first: () => go(0, 1),
        last: () => go(0, pages),
        zoomTo,
        resetView,

        /** Двойное нажатие: приблизить к точке или вернуть полный вид. */
        toggleZoom(clientX, clientY) {
            if (zoom.target > 0.05) {
                resetView();
            } else {
                zoomTo(Math.max(1.5, zoomMax * 0.75), clientX, clientY);
            }
        },

        /** Сдвиг вида на dx, dy пикселей экрана. */
        pan(dx, dy) {
            const scale = 2 * dFit / Math.exp(zoom.x) * TAN / stage.size.h;
            pan.x -= dx * scale;
            pan.y += dy * scale;
            anchor = null;
            stage.invalidate();
        },

        /** Берёт лист в руку. Возвращает false, если брать нечего. */
        grab(p) {
            if (p.leaf < 0 || zoom.target > 0.05) {
                return false;
            }
            held = p.leaf;
            const item = leaves[held];
            item.grab = clamp(p.v, 0, 1);
            if (rouse(item)) {
                item.vGrab = item.grab;
            }
            item.peel = 0;
            // Взяли у самого корешка — считаем, что чуть дальше: иначе лист слишком чуток к движению
            grabU = Math.max(p.u, 0.3);
            grabShift = p.side * (grabU - p.u);
            follow = item.x;
            // Очередь перелистываний отменяется: теперь решает рука
            goal = turned();
            return true;
        },

        /** Лист в руке следует за указателем. */
        drag(clientX, clientY) {
            const item = leaves[held];
            const p = ray(...ndc(clientX, clientY));
            follow = solveTurn(p.x + grabShift, grabU, { vGrab: item.vGrab, back: item.back, slope: p.slope });
            stage.invalidate();
        },

        /** Лист отпущен: летит туда, куда шёл (cancel — жест прерван, ложится на ближнюю сторону). */
        drop(cancel) {
            if (held < 0) {
                return;
            }
            const item = leaves[held];
            item.v = cancel ? 0 : clamp(item.v, -6, 6);
            item.to = item.x + 0.18 * item.v > 0.5 ? 1 : 0;
            goal = turned();
            active = single ? 2 * held + 1 + item.to : goal ? 2 * goal : 1;
            held = -1;
            plan();
            wake();
        },

        /** Отгибает угол листа под курсором; null — отпускает. */
        peel(p) {
            const index = p && held < 0 && zoom.target === 0 ? p.leaf : -1;
            leaves.forEach((item, i) => {
                if (i !== index && item.peel) {
                    item.peel = 0;
                    stage.invalidate();
                } else if (i === index && !item.peel && rouse(item)) {
                    item.vGrab = item.grab = p.v < 0.5 ? 0 : 1;
                    item.peel = PEEL;
                    stage.invalidate();
                }
            });
        },
    };

    const controller = createController(el, stage.canvas, host);

    // Газету открывают сразу на нужной странице (адрес #page-N, переход из вида для чтения): прочитанные листы
    // уже лежат слева, без перелистывания на глазах у посетителя
    const start = clamp(Math.trunc(options.startPage) || 1, 1, pages);
    if (start > 1) {
        active = start;
        goal = Math.floor(start / 2);
        for (let i = 0; i < goal; i++) {
            Object.assign(leaves[i], { x: 1, target: 1, to: 1, back: true });
        }
    }

    stage.measure();
    cam.x = cam.target = camGoal();
    plan();
    label();
    // Первый рисунок теней собирает их шейдер заранее, чтобы первый поворот листа не запнулся
    leaves[0].leaf.cast(true);
    stage.render(true);
    stage.invalidate();
    // Ждём картинку первой страницы, но недолго: газета с белым листом лучше пустого места
    await new Promise((resolve) => {
        first = resolve;
        setTimeout(resolve, 4000);
    });
    first = null;

    const book = {
        state,
        next: host.next,
        prev: host.prev,
        first: host.first,
        last: host.last,
        /** Перелистать к странице: из содержания и по адресу #page-N. Номер вне меню прижимается к краю. */
        goTo: (page) => go(0, Math.trunc(page) || 1),
        zoomTo: (z, clientX, clientY) => zoomTo(z, clientX, clientY),
        resetView,

        setImmersive(on) {
            immersive = Boolean(on);
            emit();
        },

        dispose() {
            dead = true;
            controller.dispose();
            textures.dispose();
            leaves.forEach((item) => item.leaf.dispose());
            stage.dispose();
        },
    };
    if (options.debug) {
        // Только для стенда: заморозить лист в заданной позе и снять показатели
        book.__debug = {
            hold(i, t, vGrab = CORNER, back = false) {
                Object.assign(leaves[i], { hold: t, vGrab, grab: vGrab, back });
                wake();
            },
            frames: stage.frames,
            bytes: textures.bytes,
        };
    }
    return book;
}
