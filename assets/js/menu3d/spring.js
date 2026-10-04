// Пружина с затуханием: так движутся листы, камера и зум. Чистая функция без DOM и three.
// Шаг считается по точной формуле, а не сложением скоростей, поэтому не зависит от частоты кадров
// и не «взрывается» на длинном кадре.

export const MAX_DT = 1 / 30;

const EPS_X = 0.0004;
const EPS_V = 0.004;

/**
 * Сдвигает s = { x, v, target } на dt секунд. omega — жёсткость (рад/с), zeta — затухание
 * (1 — без колебаний, чуть меньше — с лёгким перелётом). Возвращает true, пока движение не закончилось.
 */
export function stepSpring(s, dt, omega = 7, zeta = 1) {
    // После паузы (вкладка была скрыта) кадр может длиться секунды — не даём листу прыгнуть
    const h = Math.min(Math.max(dt, 0), MAX_DT);
    const y = s.x - s.target;
    const decay = Math.exp(-zeta * omega * h);
    if (zeta < 1) {
        const wd = omega * Math.sqrt(1 - zeta * zeta);
        const k = (s.v + zeta * omega * y) / wd;
        const cos = Math.cos(wd * h);
        const sin = Math.sin(wd * h);
        s.x = s.target + decay * (y * cos + k * sin);
        s.v = decay * (s.v * cos - (zeta * omega * k + wd * y) * sin);
    } else {
        const k = s.v + omega * y;
        s.x = s.target + decay * (y + k * h);
        s.v = decay * (s.v - omega * k * h);
    }
    if (Math.abs(s.x - s.target) < EPS_X && Math.abs(s.v) < EPS_V) {
        s.x = s.target;
        s.v = 0;
        return false;
    }
    return true;
}
