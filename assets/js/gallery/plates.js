// Планировщик пластин: следит, какие фотографии на экране, насколько каждая «проявлена»,
// и просит пресс перепечатать только те, у которых что-то изменилось. Пока страница стоит, кадров нет вовсе.
import { createPress } from './press.js';
import { TUNING, plateReach, plateProgress, heroProgress, introProgress, canvasOpacity } from './progress.js';

// Цвет из CSS-переменной в три числа 0…1. Браузер сам разбирает любую запись цвета — красим точку и читаем её.
function readColour(probe, name, fallback) {
    probe.fillStyle = fallback;
    probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
}

/** Запускает растровый пресс для всех [data-press] внутри root. Возвращает null, если WebGL2 недоступен. */
export function startPress(root) {
    const plates = [];
    const byElement = new Map();
    const listeners = new AbortController();
    let alive = true;
    let raf = 0;
    let stale = true;        // положение пластин на странице надо перемерить
    let vh = 0;
    let introStart = null;   // когда началась проявка первой полосы

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const press = createPress({
        ink: readColour(probe, '--gz-spot', '#d8187c'),
        paper: readColour(probe, '--gz-paper', '#fff'),
        table: readColour(probe, '--gz-table', '#1c0a02'),
    }, {
        // Контекст потерян: убираем холсты, под ними обычные цветные фотографии.
        lost() {
            for (const plate of plates) {
                plate.canvas.hidden = true;
                plate.drawn = -1;
            }
        },
        // Контекст вернулся пустым: фотографии загружаем в него заново.
        restored() {
            for (const plate of plates) {
                plate.src = plate.busy = '';
            }
            schedule();
        },
        dead: () => destroy(),
    });
    if (!press) {
        return null;
    }

    function schedule() {
        if (alive && !raf) {
            raf = requestAnimationFrame(frame);
        }
    }

    function remeasure() {
        stale = true;
        schedule();
    }

    // Все замеры — одной пачкой и только после изменения размеров. При прокрутке вёрстку не трогаем:
    // положение пластины на экране получается вычитанием прокрутки из запомненного.
    function measure() {
        stale = false;
        const y = window.scrollY;
        vh = window.innerHeight;
        const maxScroll = document.documentElement.scrollHeight - vh;
        for (const plate of plates) {
            const rect = plate.el.getBoundingClientRect();
            plate.top = rect.top + y;
            plate.height = rect.height;
            plate.reach = plateReach(plate.top, rect.height, vh, maxScroll);
        }
    }

    // Берём ту же картинку, что уже показывает <img>, — второй раз она не скачивается.
    function load(plate) {
        const { img } = plate;
        const src = img.currentSrc;
        // Ленивая картинка могла ещё не приехать — тогда вернёмся сюда по её событию load.
        if (!src || !img.complete || !img.naturalWidth) {
            return;
        }
        if (press.has(src)) {
            plate.src = src;
            plate.dirty = true;
            return;
        }
        if (plate.busy === src) {
            return;
        }
        plate.busy = src;
        const inUse = (key) => plates.some((other) => other.active && other.src === key);
        img.decode().then(() => {
            plate.busy = '';
            if (!alive || img.currentSrc !== src) {
                return;
            }
            if (press.upload(src, img, inUse)) {
                plate.src = src;
                plate.dirty = true;
                schedule();
            } else if (!press.lost) {
                plate.busy = src;   // не загрузилась и не загрузится — не пробуем заново на каждом кадре
            }
        }, () => {
            plate.busy = '';
        });
    }

    // Проявку первой полосы играем, только пока посетитель ещё не видел кадр цветным. Стили сами
    // проявляют его примерно через секунду (страховка на случай, если скрипт не запустится);
    // начать после этого с растра значило бы показать вспышку «цвет → растр → цвет».
    function introMissed(plate) {
        const pending = plate.el.getAnimations
            && plate.el.getAnimations({ subtree: true }).some((a) => a.playState !== 'finished');
        return !pending && performance.now() > TUNING.introLate;
    }

    function progressOf(plate, y, now) {
        if (!plate.hero) {
            // Проявившись, фотография остаётся цветной: обратно в растр при прокрутке она не уходит.
            // Иначе у краёв экрана всё время висели бы розовые снимки. Проявка идёт только на входе снизу:
            // пластина, чья середина уже выше середины экрана, считается проявленной — даже если её
            // проскочили рывком и промежуточных кадров не было.
            const centre = plate.top + plate.height / 2 - y;
            const p = centre <= vh / 2 ? 1 : plateProgress(centre, vh, plate.reach);
            plate.best = Math.max(plate.best || 0, p);
            return plate.best;
        }
        if (introStart === null) {
            introStart = introMissed(plate) ? -Infinity : now;
        }
        const intro = introProgress(now - introStart, TUNING.introMs);
        if (intro < 1) {
            schedule();   // единственная анимация по времени; закончившись, сама себя не продлевает
        }
        return heroProgress(intro, y, plate.top + plate.height);
    }

    function paint(plate, p) {
        const { canvas } = plate;
        const resized = canvas.width !== plate.w || canvas.height !== plate.h;
        // Разницу меньше одной ступени яркости глаз не увидит — не перерисовываем.
        // Но в крайние положения приходим точно: иначе у цели остался бы почти прозрачный холст.
        const settled = p === plate.drawn || (p > 0 && p < 1 && Math.abs(p - plate.drawn) <= 1 / 255);
        if (!resized && !plate.dirty && settled) {
            return;
        }
        if (p < 1) {
            if (resized) {
                canvas.width = plate.w;
                canvas.height = plate.h;
            }
            const cell = (plate.hero ? TUNING.cellHero : TUNING.cellPlate) * plate.scale;
            if (!press.draw(plate.ctx, plate.w, plate.h, plate.src, cell, p, plate.hero)) {
                // Пустой холст поверх фотографии оставлять нельзя.
                canvas.hidden = true;
                plate.drawn = -1;
                return;
            }
            const opacity = canvasOpacity(p);
            canvas.style.opacity = opacity < 1 ? opacity.toFixed(3) : '';
        }
        // Проявленную до конца фотографию показывает сам <img>: холст убираем.
        canvas.hidden = p >= 1;
        plate.drawn = p;
        plate.dirty = false;
        plate.el.classList.add('is-press');
    }

    function frame(now) {
        raf = 0;
        if (press.lost) {
            return;
        }
        if (stale) {
            measure();
        }
        const y = window.scrollY;
        for (const plate of plates) {
            if (!plate.active || !plate.w || !plate.h) {
                continue;
            }
            // После изменения ширины окна браузер мог выбрать другой файл из srcset.
            if (plate.img.currentSrc !== plate.src || !press.has(plate.src)) {
                load(plate);
            }
            if (press.has(plate.src)) {
                paint(plate, progressOf(plate, y, now));
            } else {
                plate.canvas.hidden = true;
                plate.drawn = -1;
            }
        }
    }

    const visibility = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const plate = byElement.get(entry.target);
            plate.active = entry.isIntersecting;
            if (!plate.active) {
                // Далеко за экраном холст не нужен — возвращаем его память.
                plate.canvas.hidden = true;
                plate.canvas.width = plate.canvas.height = 0;
                plate.drawn = -1;
            }
        }
        schedule();
    }, { rootMargin: TUNING.margin });

    const sizes = new ResizeObserver((entries) => {
        const dpr = window.devicePixelRatio || 1;
        for (const entry of entries) {
            const plate = byElement.get(entry.target);
            if (!plate) {
                continue;   // это сама страница: изменилась её высота, пластины могли сдвинуться
            }
            const css = entry.contentRect;
            const exact = entry.devicePixelContentBoxSize;
            const w = exact ? exact[0].inlineSize : css.width * dpr;
            const h = exact ? exact[0].blockSize : css.height * dpr;
            // Холст — пиксель в пиксель с экраном, иначе растр пойдёт муаром. Уменьшаем его,
            // только если экран плотнее, чем нужно, или кадр слишком велик.
            const k = Math.min(1, TUNING.dprMax / dpr, Math.sqrt(TUNING.areaMax / (w * h || 1)));
            plate.w = Math.round(w * k);
            plate.h = Math.round(h * k);
            plate.scale = css.width ? plate.w / css.width : 1;
        }
        remeasure();
    });

    for (const el of root.querySelectorAll('[data-press]')) {
        const img = el.querySelector('img');
        if (!img) {
            continue;
        }
        const canvas = document.createElement('canvas');
        canvas.className = 'press-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.hidden = true;
        canvas.width = canvas.height = 0;
        el.append(canvas);
        const plate = {
            el, img, canvas,
            ctx: canvas.getContext('2d'),
            hero: el.dataset.press === 'hero',
            active: false,
            w: 0, h: 0,          // размер холста в пикселях
            scale: 1,            // пикселей холста в одном CSS-пикселе
            top: 0, height: 0,   // положение на странице
            reach: 0,
            drawn: -1,           // с каким прогрессом напечатано в последний раз
            dirty: true,
            src: '',             // адрес фотографии, загруженной в пресс
            busy: '',            // адрес, который сейчас раскодируется
        };
        plates.push(plate);
        byElement.set(el, plate);
        img.addEventListener('load', schedule, { signal: listeners.signal });
        visibility.observe(el);
        try {
            sizes.observe(el, { box: 'device-pixel-content-box' });
        } catch (error) {
            sizes.observe(el);   // Safari точного размера в пикселях экрана не сообщает
        }
    }
    sizes.observe(document.documentElement);
    window.addEventListener('scroll', schedule, { passive: true, signal: listeners.signal });
    window.addEventListener('resize', remeasure, { passive: true, signal: listeners.signal });

    function destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        visibility.disconnect();
        sizes.disconnect();
        listeners.abort();
        for (const plate of plates) {
            plate.canvas.remove();
        }
        plates.length = 0;
        press.destroy();
    }

    return { destroy };
}
