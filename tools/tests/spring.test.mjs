// Проверка пружины: node --test tools/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DT, stepSpring } from '../../assets/js/menu3d/spring.js';

function run(s, omega, zeta, dt = 1 / 60, limit = 600) {
    let steps = 0;
    let peak = -Infinity;
    while (stepSpring(s, dt, omega, zeta) && steps < limit) {
        peak = Math.max(peak, s.x);
        steps++;
    }
    return { steps, peak };
}

test('сходится к цели и останавливается ровно в ней', () => {
    const s = { x: 0, v: 0, target: 1 };
    const { steps } = run(s, 7, 1);
    assert.equal(s.x, 1);
    assert.equal(s.v, 0);
    assert.ok(steps > 20 && steps < 120, 'кадров: ' + steps);
});

test('без колебаний не перелетает цель', () => {
    const s = { x: 0, v: 0, target: 1 };
    assert.ok(run(s, 7, 1).peak <= 1 + 1e-9);
});

test('с лёгким недозатуханием перелёт мал', () => {
    const s = { x: 0, v: 0, target: 1 };
    const { peak } = run(s, 7, 0.85);
    assert.ok(peak > 1 && peak < 1.02, 'пик: ' + peak);
    assert.equal(s.x, 1);
});

test('начальная скорость сохраняется и гасится', () => {
    const s = { x: 0.5, v: 3, target: 1 };
    stepSpring(s, 1 / 60, 7, 1);
    assert.ok(s.x > 0.5 && s.v > 0);
    run(s, 7, 1);
    assert.equal(s.x, 1);
});

test('длинный кадр обрезается до MAX_DT', () => {
    const a = { x: 0, v: 0, target: 1 };
    const b = { x: 0, v: 0, target: 1 };
    stepSpring(a, 5, 7, 1);
    stepSpring(b, MAX_DT, 7, 1);
    assert.equal(a.x, b.x);
    assert.ok(a.x < 0.05);
});

test('результат не зависит от частоты кадров', () => {
    const a = { x: 0, v: 0, target: 1 };
    const b = { x: 0, v: 0, target: 1 };
    for (let i = 0; i < 30; i++) {
        stepSpring(a, 1 / 60, 7, 1);
    }
    for (let i = 0; i < 60; i++) {
        stepSpring(b, 1 / 120, 7, 1);
    }
    assert.ok(Math.abs(a.x - b.x) < 1e-9);
});

test('в покое не двигается', () => {
    const s = { x: 1, v: 0, target: 1 };
    assert.equal(stepSpring(s, 1 / 60), false);
    assert.equal(s.x, 1);
});
