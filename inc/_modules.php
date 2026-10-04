<?php
// Подключение скриптов-модулей (галерея, 3D-меню). Вызывается страницей перед inc/_footer.php.
//
// Зачем нужна карта импорта: скрипты кэшируются браузером на год, а метку версии (?v=...) функция asset()
// ставит только на тот файл, что указан в теге <script>. Модули, которые он импортирует сам
// (import './press.js'), остались бы без метки и после правки показывались бы старыми.
// Карта импорта сообщает браузеру адрес каждого модуля уже с меткой версии.
//
//   $entry   — главный модуль страницы, например '/assets/js/gallery/main.js'
//   $dirs    — папки, все .js из которых попадают в карту (массив путей от корня сайта)
//   $options — необязательно:
//       'imports'   => array('three' => '/assets/vendor/three/0.185.1/three.module.min.js') — сторонние библиотеки по имени
//       'integrity' => array('/assets/vendor/…/three.module.min.js' => 'sha384-…')          — контрольные суммы файлов
//       'preload'   => array('/assets/js/lib/env.js')                                       — модули, нужные сразу
function module_tags($entry, $dirs, $options = array())
{
    $root = dirname(__DIR__);
    $imports = isset($options['imports']) ? $options['imports'] : array();
    $preload = isset($options['preload']) ? $options['preload'] : array();

    foreach ($dirs as $dir) {
        $files = glob($root . $dir . '/*.js');
        foreach ($files ? $files : array() as $file) {
            $path = $dir . '/' . basename($file);
            $imports[$path] = asset($path);
        }
    }

    $map = array('imports' => $imports);
    if (!empty($options['integrity'])) {
        $map['integrity'] = $options['integrity'];
    }
    // JSON_HEX_TAG и JSON_HEX_AMP не дают строке вида </script> закрыть тег раньше времени
    $json = json_encode($map, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);

    $html = '    <script type="importmap">' . $json . '</script>' . "\n";
    foreach ($preload as $path) {
        $html .= '    <link rel="modulepreload" href="' . asset($path) . '">' . "\n";
    }
    $html .= '    <script type="module" src="' . asset($entry) . '"></script>' . "\n";
    return $html;
}
