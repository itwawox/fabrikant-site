// Тесты разбора адреса страницы меню: node --test tools/tests/menu-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageHash, parsePageHash } from '../../assets/js/menu3d/route.js';

test('принимает номера страниц из меню', () => {
    assert.equal(parsePageHash('#page-1', 8), 1);
    assert.equal(parsePageHash('#page-5', 8), 5);
    assert.equal(parsePageHash('#page-8', 8), 8);
    assert.equal(parsePageHash('#page-120', 120), 120);
});

test('отклоняет страницы, которых нет в меню', () => {
    for (const hash of ['#page-0', '#page-9', '#page-999']) {
        assert.equal(parsePageHash(hash, 8), null, hash);
    }
});

test('отклоняет пустое, чужое и кривое', () => {
    for (const hash of ['', '#', '#page', '#page-', 'page-3', '#page-03', '#page-3a', '#page--3', '#page-3.5',
        '#PAGE-3', '#foto-3', '#page-1000', '#page-' + '9'.repeat(100000), null, undefined, 3]) {
        assert.equal(parsePageHash(hash, 8), null, String(hash).slice(0, 20));
    }
});

test('адрес первой страницы — без хвоста', () => {
    assert.equal(pageHash(1), '');
    assert.equal(pageHash(2), '#page-2');
    assert.equal(parsePageHash(pageHash(7), 8), 7);
});
