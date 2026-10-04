// Проверка математики «проявки» галереи. Запуск: node --test tools/tests/progress.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    TUNING, clamp01, smoothstep, plateReach, plateProgress, introProgress, heroProgress, canvasOpacity,
} from '../../assets/js/gallery/progress.js';

const VH = 900;
const near = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≉ ${expected}`);

test('clamp01 и smoothstep держат значения в отрезке 0…1', () => {
    assert.equal(clamp01(-3), 0);
    assert.equal(clamp01(0.25), 0.25);
    assert.equal(clamp01(7), 1);
    assert.equal(smoothstep(0.2, 0.8, 0), 0);
    assert.equal(smoothstep(0.2, 0.8, 0.2), 0);
    near(smoothstep(0.2, 0.8, 0.5), 0.5);
    assert.equal(smoothstep(0.2, 0.8, 0.8), 1);
    assert.equal(smoothstep(0.2, 0.8, 5), 1);
});

test('пластина: в середине экрана — цвет, у краёв и за экраном — растр', () => {
    assert.equal(plateProgress(VH / 2, VH, 0), 1);
    assert.equal(plateProgress(0, VH, 0), 0);
    assert.equal(plateProgress(VH, VH, 0), 0);
    assert.equal(plateProgress(-400, VH, 0), 0);
    assert.equal(plateProgress(VH + 400, VH, 0), 0);
});

test('пластина: вся центральная полоса цветная, границы полосы берутся из настроек', () => {
    const [inner, outer] = TUNING.plateBand;
    const half = VH / 2;
    assert.equal(plateProgress(half + inner * half, VH, 0), 1);
    assert.equal(plateProgress(half - inner * half, VH, 0), 1);
    assert.equal(plateProgress(half + outer * half, VH, 0), 0);
    near(plateProgress(half + (inner + outer) / 2 * half, VH, 0), 0.5);
});

test('пластина: проявка симметрична сверху и снизу и не убывает на пути к середине', () => {
    let last = 0;
    for (let y = VH + 300; y >= VH / 2; y -= 5) {
        const p = plateProgress(y, VH, 0);
        assert.ok(p >= 0 && p <= 1);
        assert.ok(p >= last - 1e-12, `убывает на y=${y}`);
        near(plateProgress(VH - y, VH, 0), p);
        last = p;
    }
    assert.equal(last, 1);
});

test('досягаемость: обычная пластина доходит до середины экрана', () => {
    assert.equal(plateReach(2000, 400, VH, 5000), 0);
});

test('досягаемость: пластина в самом низу страницы всё равно проявляется полностью', () => {
    // Страница 3000 px, окно 900: прокрутка до 2100. Пластина занимает последние 100 px.
    const top = 2900;
    const height = 100;
    const maxScroll = 2100;
    const reach = plateReach(top, height, VH, maxScroll);
    near(reach, (2950 - 2100 - 450) / 450);
    assert.ok(reach > 0.8 && reach < 1);
    const centre = (scrollY) => top + height / 2 - scrollY;
    assert.equal(plateProgress(centre(maxScroll), VH, reach), 1);
    // Без поправки она осталась бы растром
    assert.equal(plateProgress(centre(maxScroll), VH, 0) < 0.2, true);
    // Только показавшись из-за нижнего края — ещё растр
    assert.equal(plateProgress(centre(top - VH), VH, reach), 0);
    let last = 0;
    for (let y = top - VH; y <= maxScroll; y += 2) {
        const p = plateProgress(centre(y), VH, reach);
        assert.ok(p >= last - 1e-12);
        last = p;
    }
});

test('досягаемость: пластина в самом верху страницы цветная уже без прокрутки', () => {
    const reach = plateReach(80, 200, VH, 4000);
    near(reach, (450 - 180) / 450);
    assert.equal(plateProgress(180, VH, reach), 1);
    assert.equal(plateProgress(180 - 600, VH, reach), 0);
});

test('досягаемость: страница без прокрутки — все пластины цветные', () => {
    for (const top of [0, 300, 700]) {
        const reach = plateReach(top, 150, VH, 0);
        assert.equal(plateProgress(top + 75, VH, reach), 1);
    }
    // Отрицательный запас прокрутки (страница короче окна) считается как ноль
    assert.equal(plateReach(700, 150, VH, -200), plateReach(700, 150, VH, 0));
});

test('досягаемость никогда не доходит до 1 — иначе получилось бы деление на ноль', () => {
    const reach = plateReach(5000, 0, VH, 0);
    assert.ok(reach < 1);
    assert.ok(Number.isFinite(plateProgress(4000, VH, reach)));
});

test('проявка первой полосы: от 0 до 1, не убывает, за пределами зажата', () => {
    assert.equal(introProgress(-50, 1600), 0);
    assert.equal(introProgress(0, 1600), 0);
    near(introProgress(800, 1600), 0.5);
    assert.equal(introProgress(1600, 1600), 1);
    assert.equal(introProgress(Infinity, 1600), 1);
    let last = 0;
    for (let t = 0; t <= 1600; t += 16) {
        const p = introProgress(t, 1600);
        assert.ok(p >= last);
        last = p;
    }
    // Плавный разгон: за первую пятую времени проходит совсем немного
    assert.ok(introProgress(320, 1600) < 0.05);
});

test('первая полоса: до проявки — растр, после — цвет, при уходе вверх — снова растр', () => {
    const bottom = 800;
    const [from, to] = TUNING.heroBand;
    assert.equal(heroProgress(0, 0, bottom), 0);
    assert.equal(heroProgress(0.4, 0, bottom), 0.4);
    assert.equal(heroProgress(1, 0, bottom), 1);
    assert.equal(heroProgress(1, from * bottom, bottom), 1);
    near(heroProgress(1, (from + to) / 2 * bottom, bottom), 0.5);
    assert.equal(heroProgress(1, to * bottom, bottom), 0);
    assert.equal(heroProgress(1, 5000, bottom), 0);
    // Берётся меньшее из двух: недопроявленный кадр прокрутка не «допроявляет»
    assert.equal(heroProgress(0.3, (from + to) / 2 * bottom, bottom), 0.3);
    assert.equal(heroProgress(7, 0, bottom), 1);
    assert.equal(heroProgress(-1, 0, bottom), 0);
    let last = 1;
    for (let y = 0; y <= bottom; y += 4) {
        const p = heroProgress(1, y, bottom);
        assert.ok(p <= last + 1e-12);
        last = p;
    }
});

test('первая полоса нулевой высоты не даёт NaN', () => {
    assert.equal(heroProgress(1, 0, 0), 0);
    assert.equal(heroProgress(1, 100, 0), 0);
});

test('непрозрачность холста: плотный до порога, прозрачный на финише', () => {
    assert.equal(canvasOpacity(0), 1);
    assert.equal(canvasOpacity(TUNING.fadeFrom), 1);
    near(canvasOpacity((TUNING.fadeFrom + 1) / 2), 0.5);
    assert.equal(canvasOpacity(1), 0);
    assert.equal(canvasOpacity(2), 0);
});

test('стадии шейдера заданы возрастающими парами внутри 0…1', () => {
    for (const key of ['soften', 'grow', 'colour', 'plateBand', 'heroBand']) {
        const [a, b] = TUNING[key];
        assert.ok(a >= 0 && b <= 1 && a < b, key);
    }
});
