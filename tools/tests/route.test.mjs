// Тесты разбора адреса фотографии: node --test tools/tests/route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isOurs, parseShotHash } from '../../assets/js/gallery/route.js';

test('принимает адреса фотографий', () => {
    assert.equal(parseShotHash('#foto-fasad'), 'fasad');
    assert.equal(parseShotHash('#foto-a'), 'a');
    assert.equal(parseShotHash('#foto-7'), '7');
    assert.equal(parseShotHash('#foto-kare-2'), 'kare-2');
    assert.equal(parseShotHash('#foto--'), '-');
    assert.equal(parseShotHash('#foto-' + 'a'.repeat(40)), 'a'.repeat(40));
});

test('отклоняет пустое и чужое', () => {
    for (const hash of ['', '#', '#foto', '#foto-', 'foto-fasad', '#rubric-dom', '#fotofasad', '#photo-fasad']) {
        assert.equal(parseShotHash(hash), null, JSON.stringify(hash));
    }
});

test('отклоняет заглавные буквы, в том числе в приставке', () => {
    for (const hash of ['#foto-Fasad', '#foto-FASAD', '#FOTO-fasad', '#Foto-fasad', '#foto-фасад']) {
        assert.equal(parseShotHash(hash), null, hash);
    }
});

test('отклоняет слишком длинный id', () => {
    assert.equal(parseShotHash('#foto-' + 'a'.repeat(41)), null);
    assert.equal(parseShotHash('#foto-' + 'a'.repeat(100000)), null);
});

test('отклоняет лишние символы до, после и внутри', () => {
    const bad = [
        '#foto-fasad ', ' #foto-fasad', '#foto-fasad\n', '#foto-fasad\n#foto-sad', '##foto-fasad',
        '#foto-fasad#', '#foto-fasad?x=1', '#foto-fasad/', '#foto-fa sad', '#foto-fa_sad', '#foto-fa.sad',
        '#foto-<script>', '#foto-"onload="', "#foto-']", '#foto-a,b', '#foto-a\\b', '#foto-a\u0000',
    ];
    for (const hash of bad) {
        assert.equal(parseShotHash(hash), null, JSON.stringify(hash));
    }
});

test('не раскодирует адрес: закодированный ввод не проходит', () => {
    for (const hash of ['#foto-%66asad', '#foto-fasad%20', '#foto-%3Cscript%3E', '#foto-fasad%00', '%23foto-fasad']) {
        assert.equal(parseShotHash(hash), null, hash);
    }
});

test('никогда не бросает исключений, что бы ни передали', () => {
    const odd = [
        undefined, null, 0, 1, NaN, true, false, {}, [], ['#foto-fasad'], () => {}, Symbol('x'), 10n,
        new String('#foto-fasad'), { toString() { throw new Error('нет'); } }, Object.create(null),
    ];
    for (const value of odd) {
        assert.doesNotThrow(() => parseShotHash(value));
        assert.equal(parseShotHash(value), null);
    }
    assert.doesNotThrow(() => parseShotHash());
});

test('результат годится только как ключ: в нём нет ничего, кроме a-z, 0-9 и дефиса', () => {
    for (const hash of ['#foto-fasad', '#foto-a-1', '#foto-0']) {
        assert.match(parseShotHash(hash), /^[a-z0-9-]{1,40}$/);
    }
});

test('свои записи истории узнаём только по метке gz === 1', () => {
    assert.equal(isOurs({ gz: 1 }), true);
    assert.equal(isOurs({ gz: 1, other: 'x' }), true);
    for (const state of [null, undefined, 0, 1, '', 'gz', true, {}, [], { gz: 0 }, { gz: '1' }, { gz: true }, { gz: 2 }]) {
        assert.doesNotThrow(() => isOurs(state));
        assert.equal(isOurs(state), false, JSON.stringify(state));
    }
});
