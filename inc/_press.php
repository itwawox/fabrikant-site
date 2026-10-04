<?php
// Помощники вывода галереи «Фотохроника» (gallery.php).
// Данные берутся из data/gallery.php (каталог, правится руками) и data/gallery.build.php
// (размеры и адреса файлов, пишет tools/build-images.php).

// Экранирование: всё, что печатается из данных, проходит через эту функцию.
function e($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

// Строка srcset из массива «ширина => адрес».
function press_srcset($variants)
{
    $parts = array();
    foreach ($variants as $width => $url) {
        $parts[] = e($url) . ' ' . (int) $width . 'w';
    }
    return implode(', ', $parts);
}

// <picture> одной фотографии: AVIF и WebP на выбор браузера, JPEG — запасной вариант.
// Ширина и высота в <img> заданы, чтобы страница не прыгала при загрузке и чтобы фото не растягивалось
// шире своего настоящего размера (стили оставляют атрибут width в силе).
function press_picture($entry, $alt, $sizes, $lazy = true)
{
    $html = '<picture>';
    $full = empty($entry['webp']) ? 0 : max(array_keys($entry['webp']));
    foreach (array('avif', 'webp') as $type) {
        // Набор AVIF без самого крупного размера пропускаем: иначе браузер так и не взял бы фото в полном качестве
        if (!empty($entry[$type]) && max(array_keys($entry[$type])) >= $full) {
            $html .= '<source type="image/' . $type . '" srcset="' . press_srcset($entry[$type]) . '" sizes="' . e($sizes) . '">';
        }
    }
    return $html . '<img src="' . e($entry['jpg']) . '" width="' . (int) $entry['w'] . '" height="' . (int) $entry['h'] . '"'
        . ' alt="' . e($alt) . '"' . ($lazy ? ' loading="lazy"' : '') . ' decoding="async"></picture>';
}

// Раскладка рубрики в две газетные колонки: широкую и узкую.
// В широкой сверху стоит главное фото (lead), в узкой — вертикальные (tall). Остальные фото
// по очереди попадают в ту колонку, которая пока короче, поэтому колонки выходят примерно одной высоты,
// сколько бы фотографий ни добавили в каталог.
// Возвращает массив колонок в порядке вывода: array(array('kind' => 'wide', 'plates' => array(...)), ...).
// У каждой пластины: 'photo', 'entry' и 'slot' — wide (во всю широкую колонку), inset (малое фото в ней же) или narrow.
function press_columns($photos, $build, $flip)
{
    // Доли ширины листа: широкая колонка — 7 из 12, малое фото в ней — 62% колонки, узкая — 5 из 12
    $share = array('wide' => 7, 'inset' => 4.34, 'narrow' => 5);
    $plates = array('wide' => array(), 'narrow' => array());
    $height = array('wide' => 0, 'narrow' => 0);
    $rest = array();
    $lead = null;

    foreach ($photos as $photo) {
        if ($lead === null && $photo['size'] === 'lead') {
            $lead = $photo;
        } else {
            $rest[] = $photo;
        }
    }
    // Нет фото с пометкой lead — главным становится первое невертикальное
    if ($lead === null) {
        foreach ($rest as $i => $photo) {
            if ($photo['size'] !== 'tall') {
                $lead = $photo;
                array_splice($rest, $i, 1);
                break;
            }
        }
    }

    $queue = array();
    if ($lead !== null) {
        $queue[] = array($lead, 'wide', 'wide');
    }
    foreach ($rest as $photo) {
        if ($photo['size'] === 'tall') {
            $queue[] = array($photo, 'narrow', 'narrow');
        }
    }
    foreach ($rest as $photo) {
        if ($photo['size'] !== 'tall') {
            $queue[] = array($photo, null, null);
        }
    }

    foreach ($queue as $item) {
        list($photo, $column, $slot) = $item;
        $entry = $build[$photo['id']];
        if ($column === null) {
            $column = $height['wide'] <= $height['narrow'] ? 'wide' : 'narrow';
            $slot = $column === 'wide' ? 'inset' : 'narrow';
        }
        // Высота фото в тех же долях плюс примерное место под подпись
        $height[$column] += $share[$slot] * $entry['h'] / $entry['w'] + 0.6;
        $plates[$column][] = array('photo' => $photo, 'entry' => $entry, 'slot' => $slot);
    }

    $columns = array();
    foreach ($flip ? array('narrow', 'wide') : array('wide', 'narrow') as $kind) {
        if ($plates[$kind]) {
            $columns[] = array('kind' => $kind, 'plates' => $plates[$kind]);
        }
    }
    return $columns;
}

// Пластина на странице: фото в рамке со ссылкой на полный кадр и подписью.
// Без скрипта ссылка открывает JPEG; со скриптом — просмотр во всплывающем окне.
function press_plate($plate, $lazy = true)
{
    // Сколько места фото занимает на экране — по этому браузер выбирает файл нужной ширины
    static $sizes = array(
        'wide'   => '(min-width: 1248px) 680px, (min-width: 700px) 56vw, 100vw',
        'inset'  => '(min-width: 1248px) 420px, (min-width: 700px) 35vw, 100vw',
        'narrow' => '(min-width: 1248px) 482px, (min-width: 700px) 40vw, 100vw',
    );
    $photo = $plate['photo'];
    $entry = $plate['entry'];
    return '<figure class="plate plate--' . e($photo['size']) . '" id="foto-' . e($photo['id']) . '">'
        . '<a class="plate__link" href="' . e($entry['jpg']) . '" data-shot="' . e($photo['id']) . '">'
        . '<span class="plate__media" data-press="plate">' . press_picture($entry, $photo['alt'], $sizes[$plate['slot']], $lazy) . '</span>'
        . '</a>'
        . '<figcaption class="plate__caption">' . e($photo['caption']) . '</figcaption>'
        . '</figure>';
}

// Ступень пропорций кадра для окна просмотра (класс shot--r150 и т. п.).
// Стилям нужно знать пропорции фото, чтобы вписать его в экран по высоте ещё до загрузки файла,
// а передать точное число без атрибута style нельзя. Поэтому берём ближайшую ступень снизу:
// фото с такой пометкой гарантированно помещается, в худшем случае оно на несколько процентов меньше возможного.
function press_ratio_step($width, $height)
{
    $ratio = $width * 100 / $height;
    $step = 56;
    foreach (array(66, 74, 100, 133, 150) as $candidate) {
        if ($ratio >= $candidate) {
            $step = $candidate;
        }
    }
    return $step;
}

// Слайд окна просмотра. Фото показывается не крупнее своего настоящего размера.
// В подписи — рубрика, из которой фото: лента в окне идёт через все рубрики подряд.
function press_shot($plate)
{
    $photo = $plate['photo'];
    $entry = $plate['entry'];
    $width = (int) $entry['w'];
    $sizes = '(min-width: ' . $width . 'px) ' . $width . 'px, 100vw';
    $rubric = isset($plate['rubric']) ? '<span class="shot__rubric">' . e($plate['rubric']) . '</span> ' : '';
    return '<figure class="shot shot--r' . press_ratio_step($entry['w'], $entry['h']) . '" data-shot="' . e($photo['id']) . '">'
        . '<div class="shot__frame">' . press_picture($entry, $photo['alt'], $sizes) . '</div>'
        . '<figcaption class="shot__caption">' . $rubric . e($photo['caption']) . '</figcaption>'
        . '</figure>';
}

// Миниатюра в ленте окна просмотра: кнопка, которая переносит к фото. Картинка — самая лёгкая копия,
// и грузится она, только когда окно открыли (у закрытого окна нет размеров, ленивые картинки ждут).
function press_thumb($plate, $n)
{
    $photo = $plate['photo'];
    return '<button type="button" class="viewer__thumb" data-shot="' . e($photo['id']) . '"'
        . ' aria-label="Фото ' . (int) $n . ': ' . e($photo['caption']) . '">'
        . press_picture($plate['entry'], '', '96px')
        . '</button>';
}
