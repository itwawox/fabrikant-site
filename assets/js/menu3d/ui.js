// Панель под газетой: листание, счётчик страниц, масштаб и показ на весь экран.
// Саму газету рисует book.js; здесь только кнопки и то, что на них написано.

// Во сколько раз меняет масштаб одно нажатие «+» или «−»
const ZOOM_STEP = 1.5;

/** Связывает панель .book__bar с газетой. update(state) обновляет счётчик и кнопки, destroy() всё отвязывает. */
export function createUi(bookEl, book) {
    const find = (name) => bookEl.querySelector('.book__' + name);
    const prev = find('btn--prev');
    const next = find('btn--next');
    const zoomOut = find('btn--zoom-out');
    const zoomIn = find('btn--zoom-in');
    const full = find('btn--full');
    const count = find('count');
    const buttons = [prev, next, zoomOut, zoomIn, full];
    const poster = find('poster');
    // Настоящий полноэкранный режим есть не везде (на iPhone его нет) — тогда газету растягивает класс в book.css
    const native = Boolean(document.fullscreenEnabled && bookEl.requestFullscreen);
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    let immersive = false;

    // Кнопка, которую выключают, теряет фокус — с клавиатуры он пропал бы. Передаём его соседней кнопке.
    function setDisabled(button, disabled, neighbour) {
        if (disabled && document.activeElement === button) {
            neighbour.disabled = false;
            neighbour.focus();
        }
        button.disabled = disabled;
    }

    function label(state) {
        if (state.single) {
            return state.active + ' / ' + state.pages;
        }
        // Разворот: «2–3 / 8»; обложка и последняя страница лежат по одной: «1 / 8», «8 / 8»
        return state.visible.filter(Boolean).join('–') + ' / ' + state.pages;
    }

    function update(state) {
        const text = label(state);
        // Текст меняем только по делу: экранный диктор зачитывает каждое изменение счётчика
        if (count.textContent !== text) {
            count.textContent = text;
        }
        setDisabled(prev, !state.canPrev, next);
        setDisabled(next, !state.canNext, prev);
        setDisabled(zoomOut, state.zoom <= 1.001, zoomIn);
        setDisabled(zoomIn, state.zoom >= state.zoomMax - 0.001, zoomOut);
        full.disabled = false;
    }

    function setImmersive(on) {
        if (on === immersive) {
            return;
        }
        immersive = on;
        bookEl.classList.toggle('is-immersive', on);
        // Газету развернули хотя бы раз — совет про полный экран больше не показываем
        if (on) {
            bookEl.classList.add('has-full');
        }
        // Страница под растянутой газетой не должна прокручиваться
        document.documentElement.classList.toggle('book-lock', on);
        const text = on ? 'Свернуть' : 'На весь экран';
        full.setAttribute('aria-label', text);
        full.title = text;
        book.setImmersive(on);
    }

    function toggleFull() {
        if (immersive) {
            if (document.fullscreenElement === bookEl) {
                document.exitFullscreen();
            } else {
                setImmersive(false);
            }
        } else if (native) {
            // Браузер может отказать (например, запретом на странице) — тогда растягиваем сами
            bookEl.requestFullscreen().catch(() => setImmersive(true));
        } else {
            setImmersive(true);
        }
    }

    prev.addEventListener('click', () => book.prev(), options);
    next.addEventListener('click', () => book.next(), options);
    zoomIn.addEventListener('click', () => {
        const state = book.state();
        book.zoomTo(Math.min(state.zoomMax, state.zoom * ZOOM_STEP));
    }, options);
    zoomOut.addEventListener('click', () => {
        const zoom = book.state().zoom / ZOOM_STEP;
        // Последний шаг возвращает и масштаб, и сдвиг листа
        if (zoom < 1.05) {
            book.resetView();
        } else {
            book.zoomTo(zoom);
        }
    }, options);
    full.addEventListener('click', toggleFull, options);
    // Из полноэкранного режима выходят и клавишей Esc, мимо нашей кнопки — следим за самим режимом
    document.addEventListener('fullscreenchange', () => {
        setImmersive(document.fullscreenElement === bookEl);
    }, options);
    // Там, где газету растягиваем сами, Esc тоже должен сворачивать
    bookEl.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && immersive && !document.fullscreenElement) {
            setImmersive(false);
        }
    }, options);

    // Подсказка-рука показывает, что страницу тянут за край. Как только посетитель сам тронул газету
    // или кнопки — мышью, пальцем или с клавиатуры, — она больше не нужна.
    const dismissHint = () => bookEl.classList.remove('is-fresh');
    bookEl.classList.add('is-fresh');
    bookEl.addEventListener('pointerdown', dismissHint, { signal: listeners.signal, capture: true });
    bookEl.addEventListener('keydown', dismissHint, { signal: listeners.signal, capture: true });

    // Газета готова — картинка первой страницы, лежавшая на её месте, растворяется
    if (poster) {
        poster.animate({ opacity: 0 }, { duration: 400, fill: 'forwards' }).finished.then(() => poster.remove());
    }

    return {
        update,
        destroy() {
            listeners.abort();
            dismissHint();
            if (document.fullscreenElement === bookEl) {
                document.exitFullscreen();
            }
            setImmersive(false);
            buttons.forEach((button) => {
                button.disabled = true;
            });
            count.textContent = '1 / ' + bookEl.dataset.pages;
        },
    };
}
