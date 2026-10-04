// Адрес страницы меню — «#page-<номер>». По нему меню открывается на нужной странице,
// поэтому ссылкой на страницу с пивом или винной картой можно поделиться.
// При листании адрес меняется без новой записи в истории: «Назад» уводит со страницы меню, а не на прошлый лист.

const PAGE = /^#page-([1-9][0-9]{0,2})$/;

/** Номер страницы из location.hash, если он есть в меню из pages страниц; иначе null. */
export function parsePageHash(hash, pages) {
    const match = typeof hash === 'string' ? PAGE.exec(hash) : null;
    const page = match ? Number(match[1]) : 0;
    return page >= 1 && page <= pages ? page : null;
}

/** Адрес для страницы: у первой — без хвоста, это обычный адрес меню. */
export function pageHash(page) {
    return page > 1 ? '#page-' + page : '';
}

/** Ставит в адрес текущую страницу, не добавляя записи в историю. */
export function replacePage(page) {
    const hash = pageHash(page);
    if (location.hash !== hash) {
        history.replaceState(history.state, '', location.pathname + location.search + hash);
    }
}
