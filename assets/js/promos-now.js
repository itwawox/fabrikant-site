// Плашка «Сейчас действует» (разметку рисует inc/_promos.php). Раз в минуту пересчитывает, какие акции
// идут по времени Симферополя, — по тем же правилам, что и сервер: открытая страница сама сменит
// «Сегодня с 12:00» на «Сейчас, до 15:00», а в 15:00 уберёт счастливые часы.
(function () {
    'use strict';

    var WEEK = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];

    function pad(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function minutes(hhmm) {
        var parts = hhmm.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    /**
     * Какие акции показать. today — сегодняшняя дата и время в Симферополе: {y, m, d, min}.
     * Возвращает [{id, title, short, kind: 'live' | 'today' | 'soon', label}].
     */
    function promoItems(rules, today) {
        for (var offset = 0; offset <= 7; offset++) {
            // День через offset суток: считаем в UTC, чтобы часовой пояс компьютера не мешал
            var date = new Date(Date.UTC(today.y, today.m - 1, today.d + offset));
            var iso = date.getUTCDay() || 7;
            var md = pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
            var ymd = date.getUTCFullYear() + '-' + md;
            var found = [];
            rules.promos.forEach(function (p) {
                var w = p.when;
                if (w.days.indexOf(iso) < 0) {
                    return;
                }
                if (w.not_holidays && (rules.holidays.indexOf(md) >= 0 || rules.no_dates.indexOf(ymd) >= 0)) {
                    return;
                }
                var item = { id: p.id, title: p.title, short: p.short };
                if (offset === 0) {
                    if (!w.from) {
                        item.kind = 'live';
                        item.label = 'Сегодня весь день';
                    } else if (today.min >= minutes(w.from) && today.min < minutes(w.to)) {
                        item.kind = 'live';
                        item.label = 'Сейчас, до ' + w.to;
                    } else if (today.min < minutes(w.from)) {
                        item.kind = 'today';
                        item.label = 'Сегодня с ' + w.from;
                    } else {
                        return;
                    }
                } else {
                    item.kind = 'soon';
                    item.label = (offset === 1 ? 'Завтра' : iso === 2 ? 'Во вторник' : 'В ' + WEEK[iso - 1])
                        + (w.from ? ' с ' + w.from : '');
                }
                found.push(item);
            });
            if (found.length) {
                // Сначала то, что идёт сейчас (сортировка устойчивая — порядок из data/promos.php сохраняется)
                return found.filter(function (i) { return i.kind === 'live'; })
                    .concat(found.filter(function (i) { return i.kind !== 'live'; }));
            }
        }
        return [];
    }

    // Для тестов: node --test tools/tests/
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { promoItems: promoItems };
        return;
    }

    function escape(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function nowIn(tz) {
        var parts = {};
        new Intl.DateTimeFormat('en-GB', {
            timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
        }).formatToParts(new Date()).forEach(function (p) {
            parts[p.type] = Number(p.value);
        });
        return { y: parts.year, m: parts.month, d: parts.day, min: parts.hour * 60 + parts.minute };
    }

    Array.prototype.forEach.call(document.querySelectorAll('.promo-now[data-promos]'), function (bar) {
        var rules;
        try {
            rules = JSON.parse(bar.getAttribute('data-promos'));
        } catch (error) {
            return;
        }
        var list = bar.querySelector('.promo-now__list');
        var shown = list.innerHTML;
        function update() {
            var html = promoItems(rules, nowIn(rules.tz)).map(function (item) {
                return '<li class="promo-now__item is-' + item.kind + '"><a class="promo-now__link" href="/calendar.php#' + item.id + '">'
                    + '<span class="promo-now__when">' + escape(item.label) + '</span> '
                    + '<span class="promo-now__title">' + escape(item.title) + '</span> '
                    + '<span class="promo-now__what">' + escape(item.short) + '</span></a></li>';
            }).join('');
            // Перерисовываем, только если что-то поменялось: иначе сбросился бы фокус и выделение
            if (html !== shown) {
                shown = list.innerHTML = html;
                bar.hidden = !html;
            }
        }
        update();
        setInterval(update, 60000);
    });
})();
