<?php
// Общее для страницы «Меню» и скриптов в tools/: разделы меню и запись data/menu.php.

/**
 * Адрес раздела латиницей: «Рыба и морепродукты» → «ryba-i-moreprodukty». По нему раздел открывается
 * ссылкой (/menu.php#supy) — для QR на столах, соцсетей и рассылок.
 */
function menu_slug($title)
{
    static $map = array(
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e', 'ж' => 'zh',
        'з' => 'z', 'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o',
        'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'c',
        'ч' => 'ch', 'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu',
        'я' => 'ya',
    );
    $slug = strtr(mb_strtolower($title), $map);
    $slug = trim(preg_replace('/[^a-z0-9]+/', '-', $slug), '-');
    // Пустой или похожий на адрес страницы («page-3») — с приставкой, чтобы не спутать
    return $slug === '' || preg_match('/^page-\d+$/', $slug) ? 'razdel-' . $slug : $slug;
}

/**
 * Разделы меню из data/menu.php, проверенные и с адресами. У каждого: id, page, title и boxes —
 * рамки на странице [x, y, ширина, высота] в долях листа (0…1). Раздел, перетекающий в соседнюю
 * колонку, — несколько рамок. Кривые записи (нет страницы, рамка за листом) пропускаются.
 */
function menu_sections($menu)
{
    $pages = count($menu['pages']);
    $list = isset($menu['sections']) && is_array($menu['sections']) ? $menu['sections'] : array();
    $used = array();
    $sections = array();
    foreach ($list as $section) {
        $page = isset($section['page']) ? (int) $section['page'] : 0;
        $title = isset($section['title']) ? trim($section['title']) : '';
        if ($page < 1 || $page > $pages || $title === '' || empty($section['boxes'])) {
            continue;
        }
        $boxes = array();
        foreach ($section['boxes'] as $box) {
            if (!is_array($box) || count($box) !== 4) {
                continue;
            }
            list($x, $y, $w, $h) = array_map('floatval', array_values($box));
            $x = max(0, min(1, $x));
            $y = max(0, min(1, $y));
            $w = min(1 - $x, $w);
            $h = min(1 - $y, $h);
            if ($w > 0.02 && $h > 0.02) {
                $boxes[] = array($x, $y, $w, $h);
            }
        }
        if (!$boxes) {
            continue;
        }
        // Два раздела с одним названием получают адреса «salaty» и «salaty-2»
        $id = menu_slug($title);
        $base = $id;
        for ($i = 2; isset($used[$id]); $i++) {
            $id = $base . '-' . $i;
        }
        $used[$id] = true;
        $sections[] = array('id' => $id, 'page' => $page, 'title' => $title, 'boxes' => $boxes);
    }
    // По страницам; внутри страницы — в том порядке, в каком записаны (так их читают)
    $order = array_flip(array_keys($sections));
    uksort($sections, function ($a, $b) use ($sections, $order) {
        return $sections[$a]['page'] - $sections[$b]['page'] ?: $order[$a] - $order[$b];
    });
    return array_values($sections);
}

/**
 * Переписывает в data/menu.php массив меню: имя, сезон, подписи страниц и разделы.
 * Комментарий-инструкцию в начале файла оставляет как есть.
 */
function menu_config_write($file, $menu)
{
    $config = file_get_contents($file);
    $at = strpos($config, 'return array(');
    if ($config === false || $at === false) {
        return false;
    }
    $q = function ($s) {
        return "'" . addcslashes($s, "'\\") . "'";
    };
    $body = "return array(\n"
        . "    'name' => " . $q($menu['name']) . ",\n"
        . "    'season' => " . $q($menu['season']) . ",\n"
        . "    'pages' => array(\n";
    foreach ($menu['pages'] as $title) {
        $body .= '        ' . $q($title) . ",\n";
    }
    $body .= "    ),\n";
    $body .= "    // Разделы: страница, название и рамки на листе [x, y, ширина, высота] в долях листа.\n"
        . "    // Размечать удобнее в окне: php tools/menu-sections.php\n"
        . "    'sections' => array(\n";
    foreach (isset($menu['sections']) ? $menu['sections'] : array() as $section) {
        $boxes = array();
        foreach ($section['boxes'] as $box) {
            $boxes[] = vsprintf('array(%.3F, %.3F, %.3F, %.3F)', array_values($box));
        }
        $body .= "        array('page' => " . (int) $section['page'] . ", 'title' => " . $q($section['title'])
            . ", 'boxes' => array(" . implode(', ', $boxes) . ")),\n";
    }
    $body .= "    ),\n);\n";
    return file_put_contents($file, substr($config, 0, $at) . $body) !== false;
}
