// Что умеет браузер и чего хочет посетитель. Общий модуль галереи и 3D-меню.

/** Посетитель просил поменьше движения. */
export function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Включена экономия трафика. */
export function saveData() {
    return Boolean(navigator.connection && navigator.connection.saveData);
}

/** Браузер умеет плавно менять состояние страницы (View Transitions). */
export const canViewTransition = typeof document.startViewTransition === 'function';

/**
 * Есть ли аппаратный WebGL2. Программную отрисовку не считаем: эффекты на ней тормозят.
 * Пробный контекст сразу освобождаем — браузеры ограничивают их число на вкладку.
 */
export function probeWebGL2() {
    try {
        const gl = document.createElement('canvas')
            .getContext('webgl2', { failIfMajorPerformanceCaveat: true });
        if (!gl) {
            return false;
        }
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) {
            lose.loseContext();
        }
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Ждёт, пока страницу действительно покажут. Браузер может отрисовать её заранее,
 * в невидимой вкладке (prerender) — запускать там графику незачем.
 */
export function whenActivated() {
    if (!document.prerendering) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        document.addEventListener('prerenderingchange', () => resolve(), { once: true });
    });
}
