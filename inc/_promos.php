<?php
// Плашка «Сейчас действует»: какие акции из data/promos.php идут в эту минуту по времени Симферополя.
// Сервер рисует её сразу, а assets/js/promos-now.js раз в минуту пересчитывает по тем же правилам —
// если гость держит страницу открытой, плашка сама сменится в 12:00 и в 15:00.

const PROMO_TZ = 'Europe/Simferopol';

/** Акции, которые сегодня или в ближайшие дни можно показать в плашке, с подписью «когда». */
function promo_items($data, DateTimeImmutable $now)
{
    $promos = array_filter($data['promos'], function ($p) {
        return isset($p['when']) && empty($p['off']);
    });
    $week = array('понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье');
    $minutes = (int) $now->format('G') * 60 + (int) $now->format('i');
    // Сегодня: идёт сейчас или начнётся позже; затем — ближайший день, когда что-то будет
    for ($offset = 0; $offset <= 7; $offset++) {
        $day = $now->modify('+' . $offset . ' day');
        $found = array();
        foreach ($promos as $p) {
            if (!promo_runs_on($p['when'], $day, $data)) {
                continue;
            }
            $from = isset($p['when']['from']) ? promo_minutes($p['when']['from']) : null;
            $to = isset($p['when']['to']) ? promo_minutes($p['when']['to']) : null;
            if ($offset === 0) {
                if ($from === null) {
                    $found[] = promo_item($p, 'live', 'Сегодня весь день');
                } elseif ($minutes >= $from && $minutes < $to) {
                    $found[] = promo_item($p, 'live', 'Сейчас, до ' . $p['when']['to']);
                } elseif ($minutes < $from) {
                    $found[] = promo_item($p, 'today', 'Сегодня с ' . $p['when']['from']);
                }
            } else {
                $name = $offset === 1 ? 'Завтра' : ($day->format('N') == 2 ? 'Во вторник' : 'В ' . $week[$day->format('N') - 1]);
                $found[] = promo_item($p, 'soon', $name . ($from === null ? '' : ' с ' . $p['when']['from']));
            }
        }
        // Сегодня что-то есть — показываем только сегодняшнее; нет — первый день, когда будет
        if ($found) {
            // Сначала то, что идёт сейчас
            usort($found, function ($a, $b) {
                return ($a['kind'] !== 'live') - ($b['kind'] !== 'live');
            });
            return $found;
        }
    }
    return array();
}

/** Идёт ли акция в этот день недели и не выпадает ли день на праздник или концерт. */
function promo_runs_on($when, DateTimeImmutable $day, $data)
{
    if (!in_array((int) $day->format('N'), $when['days'], true)) {
        return false;
    }
    if (!empty($when['not_holidays'])) {
        if (in_array($day->format('m-d'), $data['holidays'], true) || in_array($day->format('Y-m-d'), $data['no_dates'], true)) {
            return false;
        }
    }
    return true;
}

function promo_minutes($hhmm)
{
    list($h, $m) = array_map('intval', explode(':', $hhmm));
    return $h * 60 + $m;
}

function promo_item($p, $kind, $label)
{
    return array('id' => $p['id'], 'title' => $p['title'], 'short' => $p['short'], 'kind' => $kind, 'label' => $label);
}

/**
 * Плашка с акциями. Правила (дни, часы, праздники) уходят в атрибут data-promos,
 * чтобы скрипт пересчитывал её без сервера. Акций в ближайшую неделю нет — плашка скрыта.
 */
function promo_bar($data, $class = '')
{
    $now = new DateTimeImmutable('now', new DateTimeZone(PROMO_TZ));
    $items = promo_items($data, $now);
    $rules = array(
        'tz' => PROMO_TZ,
        'holidays' => $data['holidays'],
        'no_dates' => $data['no_dates'],
        'promos' => array_values(array_map(function ($p) {
            return array('id' => $p['id'], 'title' => $p['title'], 'short' => $p['short'], 'when' => $p['when']);
        }, array_filter($data['promos'], function ($p) {
            return isset($p['when']) && empty($p['off']);
        }))),
    );
    $html = '<aside class="promo-now' . ($class ? ' ' . $class : '') . '" aria-label="Акции сегодня"'
        . ' data-promos="' . htmlspecialchars(json_encode($rules, JSON_UNESCAPED_UNICODE)) . '"' . ($items ? '' : ' hidden') . '>'
        . '<ul class="promo-now__list">';
    foreach ($items as $item) {
        $html .= promo_item_html($item);
    }
    return $html . '</ul></aside>';
}

function promo_item_html($item)
{
    return '<li class="promo-now__item is-' . $item['kind'] . '"><a class="promo-now__link" href="/calendar.php#' . $item['id'] . '">'
        . '<span class="promo-now__when">' . $item['label'] . '</span> '
        . '<span class="promo-now__title">' . $item['title'] . '</span> '
        . '<span class="promo-now__what">' . $item['short'] . '</span></a></li>';
}
