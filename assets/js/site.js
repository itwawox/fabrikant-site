// Общие скрипты сайта: шапка, мобильное меню, кнопка «наверх», фоновое видео на главной.
(function () {
    'use strict';

    var navbar = document.querySelector('.navbar');
    var collapse = document.getElementById('navbar__collapse');
    var toggle = navbar.querySelector('.navbar-toggle');
    var toTop = document.getElementById('back-to-top');

    // Шапка прозрачная поверх фото в самом верху страницы и белая после прокрутки или при открытом меню
    function update() {
        var solid = window.scrollY > 0 || collapse.classList.contains('in');
        navbar.classList.toggle('navbar-inverse', solid);
        navbar.classList.toggle('navbar-default', !solid);
        toTop.classList.toggle('show', window.scrollY > 100);
    }

    window.addEventListener('scroll', update, { passive: true });
    update();

    toggle.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', collapse.classList.toggle('in'));
        update();
    });

    // Мобильное меню закрывается клавишей Esc, фокус возвращается на кнопку
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && collapse.classList.contains('in')) {
            collapse.classList.remove('in');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
            update();
        }
    });

    // Фоновое видео на главной (8 МБ) грузим только на широком экране и не в режиме экономии трафика.
    // Пока оно не пошло, виден фоновый кадр из стилей; видео проявляется поверх по классу .is-playing.
    // Не ждём window.load: он ждёт и Метрику с вебвизором, и если та подвисла, видео не стартовало вовсе.
    // effectiveType не проверяем: Chromium-браузеры (и Яндекс) называют «3g» и быстрый канал.
    var video = document.querySelector('video[data-src]');
    var connection = navigator.connection || {};
    var wantsVideo = video
        && window.matchMedia('(min-width: 768px)').matches
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && !connection.saveData;

    if (wantsVideo) {
        var retryEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

        var play = function () {
            if (!video.paused || !video.src) {
                return;
            }
            video.play().catch(function () {
                // Браузер не дал запустить сам (энергосбережение, свёрнутая вкладка) —
                // пробуем снова при первом действии посетителя или когда вкладка станет видимой.
                retryEvents.forEach(function (name) {
                    window.addEventListener(name, play, { once: true, passive: true });
                });
            });
        };

        video.addEventListener('playing', function () {
            video.classList.add('is-playing');
            retryEvents.forEach(function (name) {
                window.removeEventListener(name, play);
            });
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') {
                play();
            }
        });

        var start = function () {
            video.muted = true;
            video.autoplay = true;
            video.src = video.dataset.src;
            play();
        };
        // Даём сначала дорисоваться странице, но не дольше секунды
        if ('requestIdleCallback' in window) {
            requestIdleCallback(start, { timeout: 1000 });
        } else {
            setTimeout(start, 200);
        }
    }
})();
