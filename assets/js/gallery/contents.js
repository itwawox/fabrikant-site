// Колонтитул «В номере»: отмечает рубрику, которую сейчас читают, и докручивает её в узкую полосу.
// Рубрика «на экране» — та, что пересекает линию чуть выше середины окна.
// Без скрипта колонтитул остаётся обычным списком якорей.

/** Подключает колонтитул nav к рубрикам section.rubric внутри root. */
export function initContents(nav, root) {
    const list = nav.querySelector('.press__contents-list') || nav;
    const links = new Map();
    nav.querySelectorAll('a[href^="#rubric-"]').forEach((link) => {
        const rubric = root.getElementById(link.getAttribute('href').slice(1));
        if (rubric) {
            links.set(rubric, link);
        }
    });
    if (!links.size) {
        return { destroy() {} };
    }

    const visible = new Set();
    let marked = null;

    function mark(link) {
        if (link === marked) {
            return;
        }
        if (marked) {
            marked.removeAttribute('aria-current');
        }
        marked = link;
        if (!link) {
            return;
        }
        link.setAttribute('aria-current', 'true');
        // Только сама полоса: scrollIntoView сдвинул бы и страницу
        if (list.scrollWidth > list.clientWidth) {
            list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                visible.add(entry.target);
            } else {
                visible.delete(entry.target);
            }
        });
        // Линию пересекает не больше одной рубрики, но на стыке их может быть две — берём верхнюю по странице
        const first = Array.from(links.keys()).find((rubric) => visible.has(rubric));
        mark(first ? links.get(first) : null);
    }, { rootMargin: '-40% 0px -55% 0px' });
    links.forEach((link, rubric) => observer.observe(rubric));

    return {
        destroy() {
            observer.disconnect();
            mark(null);
        },
    };
}
