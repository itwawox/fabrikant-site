<?php
// Шапка сайта. Каждая страница — один пункт, без вложенных списков: так все разделы видны сразу
// и ни один не встречается дважды. Пункт текущей страницы отмечен (aria-current), стили подчёркивают его.
$nav_items = array(
    '/about.php'    => 'О ресторане',
    '/menu.php'     => 'Меню',
    '/gallery.php'  => 'Галерея',
    '/calendar.php' => 'Акции',
    '/contacts.php' => 'Контакты',
);
$nav_current = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
?>
    <nav class="navbar navbar-default navbar-fixed-top" aria-label="Разделы сайта">
        <div class="container">
            <div class="navbar-header">
                <button type="button" class="navbar-toggle collapsed" aria-controls="navbar__collapse" aria-expanded="false">
                    <span class="sr-only">Меню</span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                    <span class="icon-bar"></span>
                </button>
                <a class="navbar-brand" href="/">Фабрикантъ</a>
            </div>
            <div class="collapse navbar-collapse" id="navbar__collapse">
                <ul class="nav navbar-nav navbar-right">
<?php foreach ($nav_items as $nav_href => $nav_title): ?>
                    <li><a href="<?= $nav_href ?>"<?= $nav_href === $nav_current ? ' aria-current="page"' : '' ?>><?= $nav_title ?></a></li>
<?php endforeach; ?>
                </ul>
            </div>
        </div>
    </nav>
