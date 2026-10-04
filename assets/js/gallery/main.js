// Галерея «Фотохроника»: просмотр фотографий во всплывающем окне, колонтитул с рубриками и «печатный пресс» —
// растровая печать, из которой фотографии проявляются в цвет.
// Без этого скрипта страница остаётся обычной цветной галереей со ссылками на фотографии.
import { reducedMotion, saveData, whenActivated } from '../lib/env.js';
import { initViewer } from './viewer.js';
import { initContents } from './contents.js';

const dialog = document.querySelector('.viewer');
if (dialog && typeof dialog.showModal === 'function') {
    initViewer(dialog, document);
}

const contents = document.querySelector('.press__contents');
if (contents) {
    initContents(contents, document);
}

// Звонок, меню и маршрут из приглашения в конце номера — цели в Яндекс.Метрике.
// Счётчик мог не загрузиться (блокировщик) — тогда молча
document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('[data-goal]') : null;
    if (link) {
        try {
            window.yaCounter26918373.reachGoal(link.dataset.goal);
        } catch (error) {
            // счётчик недоступен
        }
    }
});

// Пресс — украшение: его не запускаем, если посетитель просил меньше движения или бережёт трафик,
// и грузим отдельно, чтобы он не задерживал просмотр фотографий.
whenActivated().then(async () => {
    if (reducedMotion() || saveData()) {
        return;
    }
    const { startPress } = await import('./plates.js');
    startPress(document);
});
