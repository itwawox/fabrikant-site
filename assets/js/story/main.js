// «О ресторане»: колонтитул с рубриками (тот же, что в галерее) и цели Метрики у кнопок приглашения.
// Без скрипта страница целиком работает: колонтитул — обычные якоря.
import { initContents } from '../gallery/contents.js';

const contents = document.querySelector('.press__contents');
if (contents) {
    initContents(contents, document);
}

// Звонок, почта, галерея и маршрут — цели в Яндекс.Метрике. Счётчик мог не загрузиться — тогда молча
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
