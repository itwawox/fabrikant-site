// Адрес фотографии в смотровой — «#foto-<id>». По адресу решаем, открыто ли окно и какое фото в нём,
// поэтому работают «Назад», «Вперёд» и прямые ссылки на снимок.

const SHOT = /^#foto-([a-z0-9-]{1,40})$/;

/** Достаёт id фотографии из location.hash; всё, что не похоже на наш адрес, даёт null. */
export function parseShotHash(hash) {
    const match = typeof hash === 'string' ? SHOT.exec(hash) : null;
    return match ? match[1] : null;
}

/** Запись истории создана смотровой, то есть «Назад» из неё ведёт на эту же страницу без окна. */
export function isOurs(state) {
    return Boolean(state) && state.gz === 1;
}

/** Открытие фото: новая запись истории, чтобы «Назад» закрывало окно. */
export function pushShot(id) {
    history.pushState({ gz: 1 }, '', '#foto-' + id);
}

/** Листание: запись та же, меняется только адрес — «Назад» по-прежнему закрывает окно. */
export function replaceShot(id) {
    history.replaceState(history.state, '', '#foto-' + id);
}

/** Убирает «#foto-…» из адреса, не добавляя записи (окно открыли по прямой ссылке — возвращаться некуда). */
export function clearShot() {
    history.replaceState(history.state, '', location.pathname + location.search);
}
