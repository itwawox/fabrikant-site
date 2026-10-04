// Смотровая: фотография открывается поверх страницы в <dialog> и листается свайпом, стрелками, клавишами
// и миниатюрами внизу. Смахнув фото пальцем вниз, окно закрывают; кнопка сверху делится ссылкой на фото.
// Вся разметка приходит с сервера — скрипт только показывает, прячет и следит за адресом.
// Правда о том, что открыто, хранится в адресе (#foto-id): окно лишь подстраивается под него.
import { canViewTransition, reducedMotion } from '../lib/env.js';
import { clearShot, isOurs, parseShotHash, pushShot, replaceShot } from './route.js';

// Общее имя для кадра на странице и в окне: по нему браузер «выращивает» одно из другого.
const NAME = 'gz-shot';
const KEYS = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
// Смахивание вниз: на сколько пикселей протащить фото, чтобы окно закрылось, и с какого сдвига жест считается начатым
const DISMISS = 110;
const SLOP = 10;

/** Подключает смотровую: ссылки пластин, адрес и историю, ленту, кнопки, клавиши и плавное открытие. */
export function initViewer(dialog, root) {
    const track = dialog.querySelector('.viewer__track');
    const slides = Array.from(dialog.querySelectorAll('.shot[data-shot]'));
    const counter = dialog.querySelector('.viewer__current');
    const closeBtn = dialog.querySelector('.viewer__btn--close');
    const prevBtn = dialog.querySelector('.viewer__btn--prev');
    const nextBtn = dialog.querySelector('.viewer__btn--next');
    const shareBtn = dialog.querySelector('.viewer__btn--share');
    const strip = dialog.querySelector('.viewer__strip');
    const thumbs = Array.from(dialog.querySelectorAll('.viewer__thumb[data-shot]'));
    const toast = dialog.querySelector('.viewer__toast');
    if (!track || !slides.length || !counter || !closeBtn || !prevBtn || !nextBtn) {
        return { destroy() {} };
    }

    // Белый список фотографий. Текст из адреса сверяется только с ним
    // и никогда не попадает в селектор или разметку.
    const ids = slides.map((slide) => slide.dataset.shot);
    const index = new Map(ids.map((id, i) => [id, i]));
    const links = new Map();
    root.querySelectorAll('.plate__link[data-shot]').forEach((link) => links.set(link.dataset.shot, link));

    const abort = new AbortController();
    const on = (target, type, handler) => target.addEventListener(type, handler, { signal: abort.signal });

    let state = 'closed'; // closed | opening | open | closing
    let current = -1;
    let goal = -1;        // куда едет лента после кнопки или клавиши
    let run = 0;          // номер действия: начатое раньше и перебитое новым ничего не доделывает
    let transition = null;
    let named = null;     // единственный элемент с именем перехода (двух одинаковых имён быть не должно)
    let leaving = false;  // попросили у браузера «Назад» и ждём popstate
    let ownCloses = 0;    // сколько событий close вызвали мы сами
    let timer = 0;
    let popTimer = 0;
    let toastTimer = 0;
    let drag = null;      // смахивание вниз: { id, x, y, dy, mode: 'wait' | 'pull' }
    let pulledAt = -Infinity; // когда отпустили смахиваемое фото: следом браузер может прислать щелчок

    const animated = () => canViewTransition && !reducedMotion();
    const frameOf = (i) => slides[i].querySelector('.shot__frame');
    const mediaOf = (link) => (link ? link.querySelector('.plate__media') : null);

    function name(element) {
        if (named) {
            named.style.viewTransitionName = '';
        }
        named = element;
        if (named) {
            named.style.viewTransitionName = NAME;
        }
    }

    function eager(i) {
        const img = slides[i] ? slides[i].querySelector('img') : null;
        if (img) {
            img.loading = 'eager';
        }
        return img;
    }

    // Кнопку на краю ленты выключаем. Если фокус стоял на ней, сначала переносим его,
    // иначе он пропадёт вместе с кнопкой и клавиши перестанут доходить до окна.
    function limit(button, off, other) {
        if (off && document.activeElement === button) {
            (other.disabled ? closeBtn : other).focus();
        }
        button.disabled = off;
    }

    // Миниатюра текущего фото отмечена и докручена в середину ленты (прокручиваем только саму ленту)
    function markThumb(i) {
        thumbs.forEach((thumb, n) => {
            if (n === i) {
                thumb.setAttribute('aria-current', 'true');
            } else {
                thumb.removeAttribute('aria-current');
            }
        });
        const thumb = thumbs[i];
        if (strip && thumb && strip.scrollWidth > strip.clientWidth) {
            strip.scrollTo({
                left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2,
                behavior: reducedMotion() ? 'instant' : 'smooth',
            });
        }
    }

    function say(text) {
        if (!toast) {
            return;
        }
        clearTimeout(toastTimer);
        toast.textContent = text;
        toast.classList.add('is-shown');
        toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2200);
    }

    // Ссылка на текущее фото: системное меню «Поделиться», где оно есть, иначе — в буфер обмена
    async function share() {
        const url = location.href;
        const caption = slides[current].querySelector('.shot__caption');
        if (navigator.share) {
            try {
                await navigator.share({ title: document.title, text: caption ? caption.textContent : '', url });
            } catch (error) {
                // Посетитель закрыл меню «Поделиться» — это не ошибка
            }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            say('Ссылка на фото скопирована');
        } catch (error) {
            say('Не получилось скопировать ссылку');
        }
    }

    // Возвращает фото и фон окна на место после смахивания: плавно — если фото отпустили, сразу — при закрытии
    function resetDrag(animate) {
        const frame = drag && drag.frame;
        drag = null;
        dialog.style.backgroundColor = '';
        if (!frame) {
            return;
        }
        if (animate && !reducedMotion()) {
            frame.classList.add('is-returning');
            frame.addEventListener('transitionend', () => frame.classList.remove('is-returning'), { once: true });
        }
        frame.style.translate = '';
    }

    function setCurrent(i) {
        if (i !== current) {
            current = i;
            slides.forEach((slide, n) => slide.classList.toggle('is-current', n === i));
            counter.textContent = String(i + 1);
            markThumb(i);
            prevBtn.disabled = nextBtn.disabled = false;
            limit(prevBtn, i === 0, nextBtn);
            limit(nextBtn, i === slides.length - 1, prevBtn);
            // Соседние фото грузим заранее, чтобы свайп не открывал пустой кадр.
            [i - 1, i, i + 1].forEach(eager);
        }
        if (parseShotHash(location.hash) !== ids[i]) {
            replaceShot(ids[i]);
        }
    }

    // На сайте включена плавная прокрутка, поэтому мгновенный прыжок нужно просить явно.
    function place(i, smooth) {
        const box = track.getBoundingClientRect();
        const rect = slides[i].getBoundingClientRect();
        // Именно scrollTo: относительный scrollBy лента с обязательными остановками обрывает на соседнем слайде.
        track.scrollTo({
            left: track.scrollLeft + rect.left + rect.width / 2 - box.left - box.width / 2,
            behavior: smooth && !reducedMotion() ? 'smooth' : 'instant',
        });
    }

    function go(i, smooth) {
        const to = Math.max(0, Math.min(slides.length - 1, i));
        if (state === 'open' && to !== current) {
            goal = to;
            setCurrent(to);
            place(to, smooth);
        }
    }

    // Обрывает незаконченное открытие или закрытие, когда посетитель уже передумал.
    function stop() {
        run += 1;
        if (transition) {
            transition.skipTransition();
        }
        transition = null;
        name(null);
    }

    function morph(id, update, end) {
        transition = document.startViewTransition(() => {
            if (id === run) {
                update();
            }
        });
        // Оборванный переход сообщает об этом отказом ready — это не ошибка.
        transition.ready.catch(() => {});
        transition.finished.finally(() => {
            if (id === run) {
                name(null);
                transition = null;
                state = end;
            }
        });
    }

    // Пластину текущего фото возвращаем на экран: в неё «сядет» кадр и на неё встанет фокус.
    function bringPlate(link) {
        const rect = link.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            link.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
    }

    async function show(i, animate) {
        if ((state === 'open' || state === 'opening') && i === current) {
            return;
        }
        stop();
        const id = run;
        const img = eager(i);
        const reveal = () => {
            if (!dialog.open) {
                dialog.showModal();
                closeBtn.focus();
            }
            place(i, false);
        };
        state = 'opening';
        goal = -1;
        setCurrent(i);
        if (dialog.open || !animate || !animated()) {
            reveal();
            state = 'open';
            return;
        }
        // Кадру нужны пиксели, иначе вырастет пустая рамка. Ждём картинку недолго: открытие важнее.
        await Promise.race([
            img ? img.decode().catch(() => {}) : null,
            new Promise((done) => setTimeout(done, 300)),
        ]);
        if (id !== run) {
            return;
        }
        name(mediaOf(links.get(ids[i])));
        morph(id, () => {
            reveal();
            name(frameOf(i));
        }, 'open');
    }

    function hide(animate) {
        if (state === 'closed' || state === 'closing') {
            return;
        }
        stop();
        if (!dialog.open) {
            state = 'closed';
            return;
        }
        const link = links.get(ids[current]);
        const leave = () => {
            resetDrag(false);
            if (dialog.open) {
                ownCloses += 1;
                dialog.close();
            }
            // Фокус — на пластину того фото, на котором закрыли, а не того, с которого начали.
            // Пластина уже на экране, поэтому прокрутка при фокусе не нужна.
            if (link) {
                link.focus({ preventScroll: true });
            }
        };
        if (link) {
            bringPlate(link);
        }
        if (!animate || !animated()) {
            leave();
            state = 'closed';
            return;
        }
        state = 'closing';
        name(frameOf(current));
        morph(run, () => {
            leave();
            name(mediaOf(link));
        }, 'closed');
    }

    // Приводит окно в соответствие с адресом. Неизвестные и чужие адреса значат «закрыто».
    function sync(animate) {
        leaving = false;
        const i = index.get(parseShotHash(location.hash));
        if (i === undefined) {
            hide(animate);
        } else {
            show(i, animate);
        }
    }

    // Убирает фото из адреса. Если запись создали мы, уходим «Назад» (окно закроет popstate),
    // иначе — окно открыли по прямой ссылке — просто стираем хеш.
    function exit() {
        if (leaving) {
            return;
        }
        if (isOurs(history.state) && history.length > 1) {
            leaving = true;
            history.back();
        } else {
            clearShot();
        }
    }

    function requestClose() {
        if (leaving || state === 'closed' || state === 'closing') {
            return;
        }
        exit();
        if (!leaving) {
            hide(true);
        }
    }

    // Текущий слайд — тот, что занял больше половины ленты.
    const watcher = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const i = slides.indexOf(entry.target);
            // Пока лента едет к цели после кнопки, слайды по пути не считаем.
            if (state === 'open' && entry.intersectionRatio >= 0.6 && (goal < 0 || goal === i)) {
                goal = -1;
                setCurrent(i);
            }
        });
    }, { root: track, threshold: 0.6 });
    slides.forEach((slide) => watcher.observe(slide));

    // Когда лента остановилась, сверяемся по геометрии: посетитель мог перехватить её пальцем на полпути.
    function settle() {
        if (state !== 'open') {
            return;
        }
        const box = track.getBoundingClientRect();
        const offset = (slide) => {
            const rect = slide.getBoundingClientRect();
            return Math.abs(rect.left + rect.width / 2 - box.left - box.width / 2);
        };
        goal = -1;
        setCurrent(slides.reduce((best, slide, n) => (offset(slide) < offset(slides[best]) ? n : best), 0));
    }

    on(track, 'scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(settle, 150);
    });

    on(root, 'click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('.plate__link[data-shot]') : null;
        const i = link ? index.get(link.dataset.shot) : undefined;
        // Щелчки с Ctrl/Cmd/Shift и средней кнопкой оставляем браузеру: фото откроется в новой вкладке.
        if (i === undefined || event.defaultPrevented || event.button !== 0
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        event.preventDefault();
        if (leaving) {
            return;
        }
        if (isOurs(history.state)) {
            replaceShot(ids[i]);
        } else {
            pushShot(ids[i]);
        }
        show(i, true);
    });

    on(closeBtn, 'click', requestClose);
    thumbs.forEach((thumb) => on(thumb, 'click', () => go(index.get(thumb.dataset.shot), true)));
    if (shareBtn && (navigator.share || (navigator.clipboard && window.isSecureContext))) {
        shareBtn.hidden = false;
        on(shareBtn, 'click', share);
    }

    // Смахивание вниз пальцем. Вбок ленту листает сам браузер (touch-action: pan-x) и тогда присылает
    // pointercancel; вертикальный жест он отдаёт нам — фото едет за пальцем, фон окна светлеет
    on(track, 'pointerdown', (event) => {
        if (event.pointerType !== 'touch' || state !== 'open' || drag) {
            return;
        }
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dy: 0, mode: 'wait', frame: null };
    });
    on(track, 'pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (drag.mode === 'wait') {
            if (Math.abs(dx) > SLOP && Math.abs(dx) >= Math.abs(dy)) {
                drag = null;
                return;
            }
            if (dy < SLOP || dy < Math.abs(dx)) {
                return;
            }
            drag.mode = 'pull';
            drag.frame = frameOf(current);
        }
        // Вверх фото не тянется, вниз — за пальцем
        drag.dy = Math.max(0, dy);
        drag.frame.style.translate = `0 ${drag.dy}px`;
        dialog.style.backgroundColor = `rgb(28 10 2 / ${(1 - Math.min(drag.dy / 420, 0.55)).toFixed(3)})`;
    });
    const release = (event) => {
        if (!drag || event.pointerId !== drag.id) {
            return;
        }
        if (drag.mode === 'pull') {
            pulledAt = event.timeStamp;
        }
        if (drag.mode === 'pull' && drag.dy > DISMISS && event.type === 'pointerup') {
            requestClose();
        } else {
            resetDrag(true);
        }
    };
    on(track, 'pointerup', release);
    on(track, 'pointercancel', release);
    on(prevBtn, 'click', () => go(current - 1, true));
    on(nextBtn, 'click', () => go(current + 1, true));

    // Окно занимает весь экран, «мимо» него не щёлкнуть. Закрываем по щелчку в пустое место слайда,
    // но не по фото, подписи или кнопкам.
    on(dialog, 'click', (event) => {
        // Щелчок сразу после смахивания — хвост того же жеста, а не просьба закрыть
        if (event.timeStamp - pulledAt < 400) {
            return;
        }
        if (event.target === dialog || event.target === track || slides.includes(event.target)) {
            requestClose();
        }
    });

    // Esc: закрываем сами, через историю, чтобы адрес и окно не разошлись.
    on(dialog, 'cancel', (event) => {
        event.preventDefault();
        requestClose();
    });

    // Повторный Esc браузер может не дать отменить и закроет окно сам — тогда догоняем адрес и фокус.
    on(dialog, 'close', () => {
        if (ownCloses > 0) {
            ownCloses -= 1;
            return;
        }
        if (dialog.open || (state !== 'open' && state !== 'opening')) {
            return;
        }
        stop();
        state = 'closed';
        const link = links.get(ids[current]);
        if (link) {
            bringPlate(link);
            link.focus({ preventScroll: true });
        }
        exit();
    });

    // Слушаем документ, а не окно: после щелчка по фото фокус может оказаться на <body>.
    on(document, 'keydown', (event) => {
        if (state !== 'open' || !Object.hasOwn(KEYS, event.key)
            || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }
        event.preventDefault();
        const step = KEYS[event.key];
        go(current + step, Number.isFinite(step));
    });

    // «Назад» и «Вперёд». Если браузер уже сам показал переход (свайп по краю экрана), второй не нужен.
    // Отвечаем следующей задачей: Chrome возвращает странице прежнюю прокрутку уже после popstate,
    // и пластину текущего фото надо ставить на экран после этого, а не до.
    on(window, 'popstate', (event) => {
        const animate = !event.hasUAVisualTransition;
        clearTimeout(popTimer);
        popTimer = setTimeout(() => sync(animate));
    });

    // Прямая ссылка на фото: открываем сразу, без перехода. Пока страница грузится, браузер ещё раз
    // прокручивает её к якорю из адреса и при этом уводит фокус из окна — после загрузки возвращаем.
    sync(false);
    on(window, 'load', () => {
        if (dialog.open && !dialog.contains(document.activeElement)) {
            closeBtn.focus();
        }
    });

    return {
        destroy() {
            abort.abort();
            watcher.disconnect();
            clearTimeout(timer);
            clearTimeout(popTimer);
            clearTimeout(toastTimer);
            resetDrag(false);
            stop();
        },
    };
}
