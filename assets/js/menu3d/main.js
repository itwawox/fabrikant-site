// Меню: вид для чтения (menu.js) или газета, которую листают (3D); содержание, адрес #page-N и окно увеличения.
// Сначала открывается вид для чтения: в нём меню читается без лишних жестов. Газету включают кнопкой
// «Листать газету» (выбор запоминается), на телефоне её нет совсем — там лист всё равно шириной с экран.
// Газета и three загружаются, только когда они нужны.
import { reducedMotion, saveData, probeWebGL2, whenActivated } from '../lib/env.js';
import { parsePageHash, replacePage } from './route.js';

const KEY = 'fabrikant.menu.mode';
const view = document.querySelector('.menu-view');
const bookEl = view.querySelector('.book');
const stage = view.querySelector('.book__stage');
const read = view.querySelector('.menu-read');
const switcher = view.querySelector('.menu-view__switch');
const modes = Array.from(switcher.querySelectorAll('.menu-view__mode'));
const tocList = view.querySelector('.menu-toc__list');
const tocLinks = Array.from(view.querySelectorAll('.menu-toc__link'));
const zoomDialog = document.querySelector('.menu-zoom');
const data = bookEl.dataset;
const pages = Number(data.pages);
// В адрес страницы подставляется только целое число
const source = (template) => (n) => template.replace('{n}', Math.trunc(n));
const lowSrc = source(data.srcLow);
const highSrc = source(data.srcHigh);
// Копия для увеличения (3200 px) есть не у каждого меню — тогда увеличиваем обычную
const zoomSrc = data.srcZoom ? source(data.srcZoom) : highSrc;
// Телефон — та же граница, что в стилях (book.css)
const phone = window.matchMedia('(max-width: 767px)').matches;
// Миниатюры из содержания: газета кладёт их на листы, пока не пришли настоящие картинки (их может не быть)
const tinySrc = data.srcTiny ? source(data.srcTiny) : null;
let book;
let ui;
let zoom;
// Номер запуска: по нему видно, что газету закрыли, пока она загружалась
let run = 0;
// Страница, на которой меню сейчас открыто (в газете — левая страница разворота).
// Адрес бывает и разделом (#supy) — тогда страница та, на которой раздел
function hashPage() {
    const target = /^#[a-z0-9-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    const inPage = target && target.closest('.menu-page');
    return parsePageHash(location.hash, pages) || (inPage ? Number(inPage.dataset.page) : null);
}
let page = hashPage() || 1;
// С какой страницы открыли окно увеличения: пока гость на ней, меню под окном не трогаем
let zoomFrom = 0;

// Выбранный вид запоминаем; если хранилище закрыто, обходимся без него
function memory(mode) {
    try {
        return mode ? localStorage.setItem(KEY, mode) : localStorage.getItem(KEY);
    } catch (error) {
        return null;
    }
}

// Цель в Яндекс.Метрике: чем на странице меню пользуются. Счётчик мог не загрузиться — тогда молча
function goal(name) {
    try {
        window.yaCounter26918373.reachGoal(name);
    } catch (error) {
        // счётчик заблокирован или ещё не готов
    }
}

// Содержание отмечает видимые страницы (в газете их две — разворот) и докручивает их в свою полосу
function mark(visible) {
    let first = null;
    tocLinks.forEach((link) => {
        const on = visible.includes(Number(link.dataset.page));
        if (on) {
            link.setAttribute('aria-current', 'true');
            first = first || link;
        } else {
            link.removeAttribute('aria-current');
        }
    });
    // Прокручиваем только саму полосу содержания: scrollIntoView сдвинул бы и страницу сайта
    if (first && tocList.scrollWidth > tocList.clientWidth) {
        const left = first.offsetLeft - (tocList.clientWidth - first.offsetWidth) / 2;
        tocList.scrollTo({ left, behavior: reducedMotion() ? 'instant' : 'smooth' });
    }
}

function setPage(active, visible) {
    page = active;
    mark(visible || [active]);
    replacePage(active);
}

function goPage(n, smooth) {
    if (view.dataset.mode === 'book' && book) {
        book.goTo(n);
    } else {
        view.dispatchEvent(new CustomEvent('menu:go', { detail: { page: n, smooth } }));
    }
}

function show(mode) {
    const flat = mode === 'flat';
    view.dataset.mode = mode;
    // Заставка газеты и миниатюры содержания нужны только газете: до неё на их месте прозрачная точка
    if (!flat) {
        view.querySelectorAll('.book img[data-src], .menu-toc img[data-src]').forEach((img) => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
    bookEl.hidden = flat;
    read.hidden = !flat;
    // В переключателе нажата кнопка текущего вида
    modes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
}

// Вид для чтения открывается на странице, на которой остановились в газете
function openFlat() {
    const at = book ? book.state().active : page;
    run++;
    if (book) {
        ui.destroy();
        book.dispose();
    }
    book = ui = null;
    stage.replaceChildren();
    show('flat');
    if (at > 1) {
        view.dispatchEvent(new CustomEvent('menu:go', { detail: { page: at, smooth: false } }));
    } else {
        view.scrollIntoView({ behavior: 'instant' });
    }
}

// Газета не запустилась или сломалась: остаётся вид для чтения, вернуться к газете не предлагаем
function fail() {
    switcher.hidden = true;
    openFlat();
}

async function openBook(startPage) {
    const mine = ++run;
    show('book');
    try {
        const [{ createBook }, { createUi }] = await Promise.all([import('./book.js'), import('./ui.js')]);
        const made = await createBook(stage, {
            pages,
            pageRatio: data.pageH / data.pageW,
            tinySrc,
            lowSrc,
            highSrc,
            startPage,
            onChange: (state) => {
                if (ui) {
                    ui.update(state);
                }
                if (mine === run) {
                    setPage(state.active, state.visible.filter(Boolean));
                }
            },
            onFail: fail,
        });
        if (mine !== run) {
            made.dispose();
            return;
        }
        book = made;
        ui = createUi(bookEl, book);
        ui.update(book.state());
    } catch (error) {
        if (mine === run) {
            fail();
        }
    }
}

// Окно увеличения: модуль грузится при первом нажатии на страницу
async function openZoom(n, at) {
    zoomFrom = n;
    if (!zoom) {
        const { createZoom } = await import('./zoom.js');
        zoom = zoom || createZoom(zoomDialog, {
            pages,
            src: (i, size) => ({ zoom: zoomSrc, high: highSrc }[size] || lowSrc)(i),
            // Перелистнули в окне — меню под ним идёт следом, чтобы после закрытия оказаться на той же
            // странице. Пока гость на странице, с которой открыл, меню не двигаем: он вернётся к своему разделу
            onPage: (i) => {
                if (i !== zoomFrom) {
                    zoomFrom = 0;
                    view.dispatchEvent(new CustomEvent('menu:go', { detail: { page: i, smooth: false } }));
                }
            },
        });
    }
    zoom.open(n, at);
    goal('menu_zoom');
}

// Вид для чтения сообщает о новой странице (menu.js). Адрес он ставит сам — раздела, а не страницы
view.addEventListener('menu:page', (event) => {
    if (view.dataset.mode !== 'book') {
        page = event.detail.page;
        mark([page]);
    }
});

// Содержание: перелистать к странице, не прокручивая сайт
tocList.addEventListener('click', (event) => {
    const link = event.target.closest('.menu-toc__link');
    if (!link) {
        return;
    }
    event.preventDefault();
    goPage(Number(link.dataset.page), !reducedMotion());
    goal('menu_toc');
});

// Адрес поменяли руками или пришли по ссылке #page-N с этой же страницы
window.addEventListener('hashchange', () => {
    const n = parsePageHash(location.hash, pages);
    if (n && n !== page) {
        goPage(n, false);
    }
});

// Лист и кадр раздела — ссылки на крупную картинку; со скриптом вместо перехода открывается окно увеличения
read.addEventListener('click', (event) => {
    const link = event.target.closest('.menu-page__zoom, .menu-sec__crop, .menu-page__whole');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
    }
    event.preventDefault();
    // Куда нажали — туда окно и увеличит. У кадра это точка внутри его рамки на листе.
    // Нажатие с клавиатуры (detail = 0) точки не имеет: тогда начало кадра или листа
    const rect = link.getBoundingClientRect();
    const hit = event.detail && rect.width
        ? { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
        : { x: 0, y: 0 };
    let at = link.classList.contains('menu-page__zoom') ? hit : null;
    if (link.dataset.box) {
        const [x, y, w, h] = link.dataset.box.split(',').map(Number);
        at = { x: x + hit.x * w, y: y + hit.y * h };
    }
    openZoom(Number(link.dataset.page), at);
});

// Полоса содержания на ПК прокручивается стрелками; у краёв, за которыми есть ещё пункты, она затухает
// (классы has-before и has-after), чтобы было видно, что пунктов больше, чем помещается
const tocNav = tocList.parentElement;
function tocEdges() {
    const max = tocList.scrollWidth - tocList.clientWidth;
    tocNav.classList.toggle('has-before', tocList.scrollLeft > 2);
    tocNav.classList.toggle('has-after', tocList.scrollLeft < max - 2);
}
tocNav.querySelectorAll('.menu-toc__arrow').forEach((arrow) => {
    arrow.hidden = false;
    arrow.addEventListener('click', () => {
        const dir = arrow.classList.contains('menu-toc__arrow--prev') ? -1 : 1;
        tocList.scrollBy({ left: dir * tocList.clientWidth * .8, behavior: reducedMotion() ? 'instant' : 'smooth' });
    });
});
tocList.addEventListener('scroll', tocEdges, { passive: true });
if (window.ResizeObserver) {
    new ResizeObserver(tocEdges).observe(tocList);
}
tocEdges();

// Скачивание PDF и звонок — цели в Метрике
document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-goal]');
    if (link) {
        goal(link.dataset.goal);
    }
});

// Вид для чтения оживляет обычный скрипт menu.js, он выполняется после этого модуля. Ждём, пока он
// отметит его готовым, иначе команда «перейти на страницу» уйдёт в пустоту. Если он так и не
// запустился, по событию load всё равно открываем меню
const scriptsReady = read.hasAttribute('data-ready')
    ? Promise.resolve()
    : new Promise((resolve) => {
        view.addEventListener('menu:ready', resolve, { once: true });
        window.addEventListener('load', resolve, { once: true });
    });

Promise.all([whenActivated(), scriptsReady]).then(() => {
    const able = !phone && !reducedMotion() && !saveData() && !(navigator.deviceMemory <= 2) && probeWebGL2();
    switcher.hidden = !able;
    switcher.addEventListener('click', (event) => {
        const button = event.target.closest('.menu-view__mode');
        if (!button || button.dataset.mode === view.dataset.mode) {
            return;
        }
        const toFlat = button.dataset.mode === 'flat';
        memory(button.dataset.mode);
        goal(toFlat ? 'menu_mode_flat' : 'menu_mode_book');
        // Высота блока изменилась: возвращаем его начало под шапку (вид для чтения — к странице,
        // на которой остановились в газете). Фокус остаётся на переключателе
        if (toFlat) {
            openFlat();
        } else {
            openBook(page);
            view.scrollIntoView({ behavior: 'instant' });
        }
    });
    // Вид для чтения уже на месте: к разделу или странице из адреса браузер прокрутил сам
    if (able && memory() === 'book') {
        openBook(page);
    } else {
        show('flat');
    }
    mark([page]);
});
