// Картинки страниц: загрузка по очереди и в трёх размерах.
// Миниатюра (200 px, ~10 КБ) — всем страницам сразу и навсегда: пока не пришла настоящая картинка,
// на листе видна размытая страница, а не белый лист (на телефоне при быстром листании это было заметно).
// Малый размер (1000 px) — всем страницам; большой (1600 px) — только тем, что сейчас видны крупно.
import { DataTexture, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three';

const PARALLEL = 2;
const HIGH_LINGER = 8000;
// Размеры по порядку: миниатюра, малый, большой
const TINY = 0;
const LOW = 1;
const HIGH = 2;

/**
 * Хранилище текстур. options = { pages, tinySrc, lowSrc, highSrc } (tinySrc необязателен), ready() — картинка скачана и ждёт
 * выгрузки в видеокарту, swap(page) — у страницы сменилась текстура, fail() — страницу не загрузить.
 */
export function createTextures(renderer, options, ready, swap, fail) {
    // Белая заглушка: материал сразу собран «с картинкой» и не пересобирается, когда она придёт
    const blank = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    blank.colorSpace = SRGBColorSpace;
    blank.needsUpdate = true;

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const abort = new AbortController();
    // По странице на размер: { state: '' | 'load' | 'wait' | 'done', texture, bitmap }
    const tiers = [new Map(), new Map(), new Map()];
    const sources = [options.tinySrc, options.lowSrc, options.highSrc];
    const tinyWanted = [];
    for (let page = 1; options.tinySrc && page <= options.pages; page++) {
        tinyWanted.push(page);
    }
    let lowWanted = [];
    let highWanted = [];
    let running = 0;
    let lingerTimer = 0;
    let dead = false;

    function slot(tier, page) {
        if (!tiers[tier].has(page)) {
            tiers[tier].set(page, { state: '' });
        }
        return tiers[tier].get(page);
    }

    function drop(tier, page) {
        const item = slot(tier, page);
        tiers[tier].set(page, { state: '' });
        if (item.bitmap) {
            item.bitmap.close();
        }
        if (item.texture) {
            item.texture.dispose();
            swap(page);
        }
    }

    async function load(tier, page, item) {
        item.state = 'load';
        running++;
        try {
            const response = await fetch(sources[tier](page), { signal: abort.signal });
            if (!response.ok) {
                throw new Error('http ' + response.status);
            }
            const bitmap = await createImageBitmap(await response.blob());
            // Пока качали, страница могла стать ненужной (или хранилище закрыли)
            if (dead || tiers[tier].get(page) !== item) {
                bitmap.close();
            } else {
                item.bitmap = bitmap;
                item.state = 'wait';
                ready();
            }
        } catch (error) {
            item.state = 'done';
            // Без миниатюры или большого размера обойдёмся; без малого страницы нет вовсе
            if (!dead && tier === LOW) {
                fail();
            }
        }
        running--;
        pump();
    }

    function pump() {
        const queue = tinyWanted.map((page) => [TINY, page])
            .concat(highWanted.map((page) => [HIGH, page]), lowWanted.map((page) => [LOW, page]));
        for (const [tier, page] of queue) {
            if (dead || running >= PARALLEL) {
                return;
            }
            const item = slot(tier, page);
            if (!item.state) {
                load(tier, page, item);
            }
        }
    }

    return {
        blank,

        /** Лучшая из готовых текстур страницы. */
        get(page) {
            return slot(HIGH, page).texture || slot(LOW, page).texture || slot(TINY, page).texture || blank;
        },

        /**
         * Что должно быть в памяти: low — страницы малого размера в порядке важности,
         * high — страницы, которым нужен большой размер. Лишние малые освобождаются сразу,
         * лишние большие — чуть погодя: зум часто тут же возвращают.
         */
        need(low, high) {
            lowWanted = low;
            highWanted = high;
            tiers[LOW].forEach((item, page) => {
                if (!low.includes(page)) {
                    drop(LOW, page);
                }
            });
            clearTimeout(lingerTimer);
            lingerTimer = setTimeout(() => this.dropHigh(highWanted), HIGH_LINGER);
            pump();
        },

        /** Освобождает большие текстуры, кроме перечисленных страниц. */
        dropHigh(keep = []) {
            tiers[HIGH].forEach((item, page) => {
                if (!keep.includes(page)) {
                    drop(HIGH, page);
                }
            });
        },

        /**
         * Выгружает в видеокарту одну скачанную картинку (выгрузка занимает несколько миллисекунд,
         * поэтому книга зовёт это только между движениями). Миниатюра выгружается за доли миллисекунды —
         * tinyOnly: только их, это можно и пока лист в руке. Возвращает true, если ждут ещё.
         */
        flush(tinyOnly) {
            for (let tier = 0; tier < (tinyOnly ? 1 : 3); tier++) {
                for (const [page, item] of tiers[tier]) {
                    if (item.state !== 'wait') {
                        continue;
                    }
                    const texture = new Texture(item.bitmap);
                    texture.colorSpace = SRGBColorSpace;
                    // Битмап уже лежит «верхом вниз» относительно WebGL — развёртка листа это учитывает
                    texture.flipY = false;
                    texture.minFilter = LinearMipmapLinearFilter;
                    texture.anisotropy = anisotropy;
                    texture.needsUpdate = true;
                    renderer.initTexture(texture);
                    item.bytes = item.bitmap.width * item.bitmap.height * 4 * 4 / 3;
                    item.bitmap.close();
                    item.bitmap = null;
                    item.texture = texture;
                    item.state = 'done';
                    swap(page);
                    return true;
                }
            }
            return false;
        },

        /** Примерный объём памяти видеокарты под страницы, байт (с мип-уровнями). */
        bytes() {
            let total = 0;
            tiers.forEach((tier) => tier.forEach((item) => {
                total += item.texture ? item.bytes : 0;
            }));
            return Math.round(total);
        },

        /** После потери контекста текстур в видеокарте нет — качаем заново (из кэша браузера). */
        reload() {
            tiers.forEach((tier, n) => [...tier.keys()].forEach((page) => drop(n, page)));
            pump();
        },

        dispose() {
            dead = true;
            abort.abort();
            clearTimeout(lingerTimer);
            tiers.forEach((tier, n) => [...tier.keys()].forEach((page) => drop(n, page)));
            blank.dispose();
        },
    };
}
