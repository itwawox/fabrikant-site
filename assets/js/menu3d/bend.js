// Математика изгиба листа. Чистые функции без three — проверяются в node (tools/tests/bend.test.mjs).
//
// Газета лежит в плоскости XY, корешок — ось Y, +Z смотрит на зрителя. Ширина страницы принята за 1.
// u — от корешка (0) к внешнему краю (1), v — снизу (0) вверх (1).
// t — поворот листа: 0 — лежит справа, 1 — слева.

export const COLS = 41;
export const ROWS = 13;

// lambda — гибкость (0 — жёсткая доска): насколько край обгоняет корешок.
// sigma — перекос: схваченный угол идёт первым. peel — добавка к перекосу в самом начале,
// чтобы от стопки отрывался один угол, а не весь край разом.
export const BEND = { lambda: 0.9, sigma: 0.15, peel: 0.9 };

const PI = Math.PI;
const DU = 1 / (COLS - 1);
const angles = new Float32Array(COLS * ROWS);
const point = [0, 0];

/** Плавная ступенька: 0 при x <= 0, 1 при x >= 1. */
export function smooth(x) {
    return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}

// Отставание строки v от схваченной. Корень вместо модуля — чтобы на листе не было излома.
function lag(dv) {
    return Math.sqrt(dv * dv + 0.01) - 0.1;
}

// Вдоль строки фаза изгиба линейна: tau = a + b·u. Лист, который возвращают справа налево
// (back), гнётся зеркально: ведёт снова внешний край, а не корешок.
function field(t, o) {
    const tt = o.back ? 1 - t : t;
    return {
        a: tt * (1 + BEND.lambda) - BEND.lambda,
        k: (BEND.sigma + BEND.peel * Math.exp(-tt / 0.08)) * Math.sin(PI * tt),
    };
}

function angle(a, b, u, back) {
    const s = smooth(a + b * u);
    return PI * (back ? 1 - s : s);
}

/** Угол листа к столу в точке (u, v): 0 — лежит справа, π — слева. o = { vGrab, back }. */
export function alphaAt(u, v, t, o) {
    const f = field(t, o);
    return angle(f.a, BEND.lambda - f.k * lag(v - o.vGrab), u, o.back);
}

/**
 * Заполняет координаты и нормали вершин листа (COLS × ROWS, по строкам снизу вверх).
 * o = { h — высота страницы, z — высота стопки под листом, vGrab, back, curv }.
 * В curv (если передан) пишется кривизна −1…1: плюс — вогнута лицевая сторона.
 */
export function fillLeaf(pos, nrm, t, o) {
    const flat = t <= 0 || t >= 1;
    const rest = t >= 1 ? PI : 0;
    const f = field(t, o);
    const curv = o.curv;
    for (let r = 0, i = 0; r < ROWS; r++) {
        const v = r / (ROWS - 1);
        const b = BEND.lambda - f.k * lag(v - o.vGrab);
        let x = 0;
        let z = o.z;
        for (let c = 0; c < COLS; c++, i++) {
            const u = c * DU;
            pos[3 * i] = x;
            pos[3 * i + 1] = (v - 0.5) * o.h;
            pos[3 * i + 2] = z;
            angles[i] = flat ? rest : angle(f.a, b, u, o.back);
            if (curv) {
                const tau = f.a + b * u;
                curv[i] = flat || tau <= 0 || tau >= 1 ? 0
                    : (o.back ? -4 : 4) * tau * (1 - tau) * b / BEND.lambda;
            }
            // Шаг по середине отрезка: длина листа вдоль u не меняется, бумага не тянется
            const mid = flat ? rest : angle(f.a, b, u + DU / 2, o.back);
            x += DU * Math.cos(mid);
            z += DU * Math.sin(mid);
        }
    }
    // Нормаль = касательная вдоль u × касательная вдоль v (разность соседних строк)
    for (let r = 0, i = 0; r < ROWS; r++) {
        const up = 3 * (r < ROWS - 1 ? COLS : 0);
        const down = 3 * (r > 0 ? COLS : 0);
        for (let c = 0; c < COLS; c++, i++) {
            const p = 3 * i;
            const dx = pos[p + up] - pos[p - down];
            const dy = pos[p + up + 1] - pos[p - down + 1];
            const dz = pos[p + up + 2] - pos[p - down + 2];
            const cos = Math.cos(angles[i]);
            const sin = Math.sin(angles[i]);
            const nx = -sin * dy;
            const ny = sin * dx - cos * dz;
            const nz = cos * dy;
            const len = Math.hypot(nx, ny, nz) || 1;
            nrm[p] = nx / len;
            nrm[p + 1] = ny / len;
            nrm[p + 2] = nz / len;
        }
    }
}

/** Положение точки (u, v) листа: [x, высота над стопкой]. */
export function leafPoint(u, v, t, o, out = point) {
    const f = field(t, o);
    const b = BEND.lambda - f.k * lag(v - o.vGrab);
    let x = 0;
    let z = 0;
    for (let from = 0; from < u; from += DU) {
        const step = Math.min(DU, u - from);
        const mid = angle(f.a, b, from + step / 2, o.back);
        x += step * Math.cos(mid);
        z += step * Math.sin(mid);
    }
    out[0] = x;
    out[1] = z;
    return out;
}

/**
 * Поворот t, при котором схваченная точка листа (u, vGrab) оказывается под указателем.
 * x — куда указатель попал на столе; o.slope — наклон луча зрения (сдвиг по x на единицу высоты):
 * лист поднят над столом, и без поправки точка уезжала бы из-под пальца.
 */
export function solveTurn(x, u, o) {
    const slope = o.slope || 0;
    const miss = (t) => {
        const p = leafPoint(u, o.vGrab, t, o);
        return p[0] - slope * p[1] - x;
    };
    if (miss(0) <= 0) {
        return 0;
    }
    if (miss(1) >= 0) {
        return 1;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (miss(mid) > 0) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

/**
 * Высота стопки под листом i из n: справа верхний лист — первый, слева — последний.
 * Высоту меняем не по ходу всего поворота, а только когда корень листа (у корешка) сам встаёт
 * на ребро и переваливается налево. Пока корень лежит справа, лист обязан оставаться выше правой
 * стопки — иначе сквозь него проступает страница под ним. back — лист возвращают слева.
 */
export function stackZ(i, n, t, delta, back = false) {
    const tt = back ? 1 - t : t;
    const s = smooth(tt * (1 + BEND.lambda) - BEND.lambda);
    // 0 — корень лежит справа, 1 — слева; переход — около вертикали, где лист не касается ни одной стопки
    const side = smooth(((back ? 1 - s : s) - 0.35) / 0.3);
    return ((n - 1 - i) * (1 - side) + i * side) * delta;
}

/**
 * Не даёт листам проходить друг сквозь друга: всегда t[i] <= t[i-1].
 * leaves — массив { x, v, target }; pinned — лист в руке (его не трогаем, уступают соседи).
 * Уступает догоняющий: при листании вперёд — лист с большим номером, назад — с меньшим.
 */
export function orderTurns(leaves, pinned = -1) {
    for (let pass = 0; pass < leaves.length; pass++) {
        let clean = true;
        for (let i = 1; i < leaves.length; i++) {
            const a = leaves[i - 1];
            const b = leaves[i];
            if (b.x <= a.x) {
                continue;
            }
            clean = false;
            const lower = pinned === i || (pinned !== i - 1 && b.target < 0.5 && a.target < 0.5);
            const from = lower ? b : a;
            const to = lower ? a : b;
            to.x = from.x;
            to.v = from.v;
        }
        if (clean) {
            return;
        }
    }
    // Противоречивые цели (такого книга не задаёт) — просто прижимаем по порядку
    for (let i = 1; i < leaves.length; i++) {
        leaves[i].x = Math.min(leaves[i].x, leaves[i - 1].x);
    }
}
