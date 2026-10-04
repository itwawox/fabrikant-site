// Меню для чтения: страницы одна под другой, разделы слева (ПК) или полосой сверху (планшет, телефон).
// Прокрутка, якоря разделов и кадры на телефоне работают и без скрипта; этот скрипт добавляет:
//   • подсветку раздела, который сейчас на экране, и адрес раздела в строке браузера (#supy);
//   • плавный переход к разделу из оглавления и рамку вокруг него;
//   • лупу на ПК: под курсором кусок страницы крупнее;
//   • кнопку брони внизу телефона, которая уходит, когда виден подвал с контактами.
//
// С остальной страницей (газета, окно увеличения) скрипт говорит событиями на .menu-view:
//   menu:page {page} — на экране другая страница (шлёт этот скрипт);
//   menu:go {page, smooth} — перейти к странице (шлёт menu3d/main.js);
//   menu:ready — скрипт готов слушать menu:go (шлёт этот скрипт).
(function () {
    'use strict';

    var view = document.querySelector('.menu-view');
    var read = view.querySelector('.menu-read');
    var nav = read.querySelector('.menu-nav');
    var navList = nav.querySelector('.menu-nav__pages');
    var narrow = window.matchMedia('(max-width: 1023px)');
    var lensable = window.matchMedia('(hover: hover) and (min-width: 1024px)');
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var book = view.querySelector('.book').dataset;

    // Пункт оглавления и то, куда он ведёт (раздел или страница)
    var items = Array.prototype.map.call(nav.querySelectorAll('.menu-nav__link'), function (link) {
        var target = document.getElementById(link.hash.slice(1));
        var page = target && (target.closest('.menu-page') || target);
        return target && { link: link, target: target, page: Number(page.dataset.page) };
    }).filter(Boolean);
    var current = null;
    var shownPage = 0;
    // Раздел, на который нажали в оглавлении. Разделы в соседних колонках начинаются на одной высоте
    // («Холодные закуски» и «Супы»), и из равных подсвечиваем тот, к которому гость и шёл
    var chosen = null;

    // «instant», а не «auto»: у сайта плавная прокрутка в стилях (scroll-behavior), и «auto» стало бы плавным
    function behavior() {
        return calm.matches ? 'instant' : 'smooth';
    }

    // Линия чтения: под шапкой сайта и полосой разделов, с небольшим запасом
    function readingLine() {
        return 70 + (narrow.matches ? nav.offsetHeight : 0) + 48;
    }

    // На экране тот раздел, чей верх ближе всех сверху к линии чтения. На ПК разделы стоят колонками,
    // поэтому «последний в списке» не годится — берём ближайший по высоте
    // quiet — только подсветить пункт: при загрузке адрес не трогаем, браузер ещё может прокручивать
    // к разделу из ссылки (#supy), и замена адреса эту прокрутку отменила бы
    function spy(quiet) {
        // Меню для чтения скрыто (открыта газета) — считать нечего
        if (!read.offsetParent) {
            return;
        }
        var line = readingLine();
        var best = null;
        var bestTop = -Infinity;
        items.forEach(function (item) {
            // Пункт скрыт (на телефоне у страницы с разделами нет своей кнопки) — не считаем
            if (!item.link.getClientRects().length) {
                return;
            }
            var top = item.target.getBoundingClientRect().top;
            if (top <= line && (top > bestTop + 4 || (item === chosen && top > bestTop - 4))) {
                best = item;
                bestTop = top;
            }
        });
        best = best || items.filter(function (item) { return item.link.getClientRects().length; })[0];
        if (!best || best === current) {
            return;
        }
        mark(best);
        if (quiet) {
            return;
        }
        // Адрес: начало меню — без хвоста, дальше — раздел или страница. Новой записи в истории нет
        var first = items.filter(function (item) { return item.link.getClientRects().length; })[0];
        var hash = current === first ? '' : current.link.hash;
        if (location.hash !== hash) {
            history.replaceState(history.state, '', location.pathname + location.search + hash);
        }
        if (current.page !== shownPage) {
            shownPage = current.page;
            view.dispatchEvent(new CustomEvent('menu:page', { detail: { page: shownPage } }));
        }
    }

    function mark(item) {
        if (current) {
            current.link.removeAttribute('aria-current');
        }
        current = item;
        current.link.setAttribute('aria-current', 'true');
        reveal(current.link);
    }

    // Текущий пункт виден в оглавлении: в полосе — по центру, в колонке — прокрутить, если ушёл за край.
    // Прокручиваем только само оглавление: scrollIntoView сдвинул бы и страницу сайта
    function reveal(link) {
        if (narrow.matches) {
            if (navList.scrollWidth > navList.clientWidth) {
                navList.scrollTo({ left: link.offsetLeft - (navList.clientWidth - link.offsetWidth) / 2, behavior: behavior() });
            }
        } else {
            var top = link.getBoundingClientRect().top - nav.getBoundingClientRect().top;
            if (top < 0 || top + link.offsetHeight > nav.clientHeight) {
                nav.scrollTo({ top: nav.scrollTop + top - nav.clientHeight / 3, behavior: behavior() });
            }
        }
    }

    // Рамка вокруг раздела, к которому перешли; через пару секунд гаснет
    var litTimer;
    function light(target) {
        var lit = read.querySelector('.menu-sec.is-lit');
        if (lit) {
            lit.classList.remove('is-lit');
        }
        clearTimeout(litTimer);
        if (target.classList.contains('menu-sec')) {
            target.classList.add('is-lit');
            litTimer = setTimeout(function () { target.classList.remove('is-lit'); }, 2200);
        }
    }

    function go(target) {
        target.scrollIntoView({ behavior: behavior(), block: 'start' });
        light(target);
        // Фокус — туда же, чтобы с клавиатуры и экранным диктором продолжить с раздела
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    }

    nav.addEventListener('click', function (event) {
        var link = event.target.closest('.menu-nav__link');
        if (!link || event.metaKey || event.ctrlKey || event.shiftKey) {
            return;
        }
        var target = document.getElementById(link.hash.slice(1));
        if (target) {
            event.preventDefault();
            chosen = items.filter(function (item) { return item.link === link; })[0] || null;
            go(target);
            history.replaceState(history.state, '', location.pathname + location.search + link.hash);
        }
    });

    view.addEventListener('menu:go', function (event) {
        var page = read.querySelector('.menu-page[data-page="' + event.detail.page + '"]');
        if (page) {
            page.scrollIntoView({ behavior: event.detail.smooth ? behavior() : 'instant', block: 'start' });
        }
    });

    var ticking = false;
    function onScroll() {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(function () {
                ticking = false;
                spy();
            });
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Пришли по ссылке на раздел или страницу (#supy, #page-3): прокручивает к ним браузер,
    // а мы сразу отмечаем этот пункт в оглавлении и подсвечиваем раздел
    var arrived = /^#[a-z0-9-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    var arrivedItem = arrived && items.filter(function (item) { return item.target === arrived; })[0];

    // --- Лупа на ПК ---

    // Во сколько раз лупа крупнее страницы на экране. Под неё грузится копия для увеличения (3200 px),
    // а пока она идёт — та картинка, что уже на экране
    var LENS_ZOOM = 2.2;
    var lens = document.createElement('div');
    lens.className = 'menu-lens';
    lens.hidden = true;
    lens.setAttribute('aria-hidden', 'true');
    var sharp = {};
    var source = function (template, n) {
        return template.replace('{n}', n);
    };

    function lensImage(page) {
        var n = page.dataset.page;
        if (sharp[n]) {
            return sharp[n];
        }
        var img = page.querySelector('.menu-page__zoom img');
        var url = source(book.srcZoom || book.srcHigh, n);
        var full = new Image();
        full.onload = function () {
            sharp[n] = url;
        };
        full.src = url;
        return img.currentSrc || img.src;
    }

    function moveLens(event) {
        var zoomLink = event.target.closest('.menu-page__zoom');
        if (!lensable.matches || event.pointerType === 'touch' || !zoomLink) {
            lens.hidden = true;
            return;
        }
        var page = zoomLink.parentElement;
        if (lens.parentElement !== page) {
            page.appendChild(lens);
        }
        var box = zoomLink.getBoundingClientRect();
        var x = event.clientX - box.left;
        var y = event.clientY - box.top;
        lens.hidden = false;
        var w = lens.offsetWidth;
        var h = lens.offsetHeight;
        lens.style.left = (x - w / 2) + 'px';
        lens.style.top = (y - h / 2) + 'px';
        lens.style.backgroundImage = 'url("' + lensImage(page) + '")';
        lens.style.backgroundSize = (box.width * LENS_ZOOM) + 'px ' + (box.height * LENS_ZOOM) + 'px';
        lens.style.backgroundPosition = (w / 2 - x * LENS_ZOOM) + 'px ' + (h / 2 - y * LENS_ZOOM) + 'px';
    }
    read.addEventListener('pointermove', moveLens);
    read.addEventListener('pointerleave', function () { lens.hidden = true; });
    read.addEventListener('pointerdown', function () { lens.hidden = true; });
    window.addEventListener('scroll', function () { lens.hidden = true; }, { passive: true });

    // --- Кнопка брони на телефоне ---

    var dock = document.querySelector('.menu-dock');
    var footer = document.querySelector('.section_footer');
    if (dock && footer && window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
            dock.classList.toggle('is-away', entries[0].isIntersecting);
        }).observe(footer);
    }

    if (arrivedItem) {
        chosen = arrivedItem;
        mark(arrivedItem);
        shownPage = arrivedItem.page;
        light(arrived);
    } else {
        spy(true);
    }
    // menu3d/main.js ждёт этого, чтобы открыть меню на странице из адреса
    read.setAttribute('data-ready', '');
    view.dispatchEvent(new CustomEvent('menu:ready'));
})();
