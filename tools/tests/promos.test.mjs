// Тесты плашки «Сейчас действует»: node --test tools/tests/promos.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { promoItems } = require('../../assets/js/promos-now.js');

const rules = {
    holidays: ['01-01', '05-09', '11-04'],
    no_dates: ['2026-10-09'],
    promos: [
        { id: 'mujskie-dni', title: 'Мужские дни', short: '−50%', when: { days: [3] } },
        { id: 'happyhours', title: 'Счастливые часы', short: '−25%', when: { days: [1, 2, 3, 4, 5], from: '12:00', to: '15:00', not_holidays: true } },
    ],
};
// 5 октября 2026 — понедельник
const at = (d, hhmm, m = 10) => ({ y: 2026, m, d, min: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });
const brief = (items) => items.map((i) => `${i.kind}:${i.id}:${i.label}`);

test('будни в 14:00 — счастливые часы идут, до 15:00', () => {
    assert.deepEqual(brief(promoItems(rules, at(5, '14:00'))), ['live:happyhours:Сейчас, до 15:00']);
});

test('будни утром — счастливые часы позже сегодня', () => {
    assert.deepEqual(brief(promoItems(rules, at(5, '10:30'))), ['today:happyhours:Сегодня с 12:00']);
});

test('ровно в 15:00 счастливые часы закончились — показываем ближайшее', () => {
    assert.deepEqual(brief(promoItems(rules, at(5, '15:00'))), ['soon:happyhours:Завтра с 12:00']);
});

test('среда в 14:00 — обе акции, обе идут', () => {
    assert.deepEqual(brief(promoItems(rules, at(7, '14:00'))), [
        'live:mujskie-dni:Сегодня весь день',
        'live:happyhours:Сейчас, до 15:00',
    ]);
});

test('среда утром — мужские дни уже идут, счастливые часы позже', () => {
    assert.deepEqual(brief(promoItems(rules, at(7, '09:00'))), [
        'live:mujskie-dni:Сегодня весь день',
        'today:happyhours:Сегодня с 12:00',
    ]);
});

test('пятница вечером — в понедельник с 12:00', () => {
    // 9 октября — в no_dates (концерт), но вечером это уже неважно; суббота и воскресенье пустые
    assert.deepEqual(brief(promoItems(rules, at(9, '20:00'))), ['soon:happyhours:В понедельник с 12:00']);
});

test('день концерта: счастливые часы не идут, мужские дни не затронуты', () => {
    assert.deepEqual(brief(promoItems(rules, at(9, '13:00'))), ['soon:happyhours:В понедельник с 12:00']);
});

test('праздник 4 ноября (среда): только мужские дни', () => {
    assert.deepEqual(brief(promoItems(rules, at(4, '13:00', 11))), ['live:mujskie-dni:Сегодня весь день']);
});

test('вторник после 15:00 — завтра обе, сначала та, что весь день', () => {
    assert.deepEqual(brief(promoItems(rules, at(6, '16:00'))), [
        'soon:mujskie-dni:Завтра',
        'soon:happyhours:Завтра с 12:00',
    ]);
});

test('без акций со временем — пусто', () => {
    assert.deepEqual(promoItems({ ...rules, promos: [] }, at(5, '14:00')), []);
});
