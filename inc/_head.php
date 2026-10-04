<?php
// Начало страницы: <head>, стили, навигация и (если задан $page_heading) шапка с заголовком.
// Страница перед подключением задаёт:
//   $page_title   — заголовок вкладки
//   $page_heading — заголовок в шапке (на главной не задаётся)
//   $page_hero    — фон шапки: hall или stage (файлы в assets/img/hero), он же предзагружается;
//                   false — если шапки с фоном на странице нет
//   $page_css     — дополнительные стили страницы (массив путей), необязательно
//   $page_description — описание страницы для поисковиков и превью ссылки в мессенджерах, необязательно
//   $page_image   — картинка превью ссылки (путь от корня сайта), необязательно
//   $page_head    — готовая разметка в конец <head> (например, JSON-LD), необязательно
require_once __DIR__ . '/_helpers.php';
$page_css = isset($page_css) ? $page_css : array();
$page_hero = isset($page_hero) ? $page_hero : 'home-poster';
$hero_mobile = $page_hero === 'home-poster' ? $page_hero : $page_hero . '-m';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= $page_title ?></title>
<?php if (isset($page_description)): ?>
    <meta name="description" content="<?= htmlspecialchars($page_description) ?>">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ФабрикантЪ">
    <meta property="og:title" content="<?= htmlspecialchars($page_title) ?>">
    <meta property="og:description" content="<?= htmlspecialchars($page_description) ?>">
<?php endif; ?>
<?php if (isset($page_image)): ?>
    <meta property="og:image" content="https://<?= htmlspecialchars($_SERVER['HTTP_HOST'] . $page_image) ?>">
<?php endif; ?>
    <link rel="icon" href="/assets/favicon/favicon.png">
    <link rel="preload" href="/assets/fonts/arkhive.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/afisha.woff2" as="font" type="font/woff2" crossorigin>
<?php if ($page_hero): ?>
    <link rel="preload" href="/assets/img/hero/<?= $hero_mobile ?>.webp" as="image" type="image/webp" media="(max-width: 767px)">
    <link rel="preload" href="/assets/img/hero/<?= $page_hero ?>.webp" as="image" type="image/webp" media="(min-width: 768px)">
<?php endif; ?>
    <link rel="stylesheet" href="<?= asset('/assets/css/site.css') ?>">
<?php foreach ($page_css as $css): ?>
    <link rel="stylesheet" href="<?= asset($css) ?>">
<?php endforeach; ?>
<?= isset($page_head) ? $page_head : '' ?>
</head>
<body>
<?php include __DIR__ . '/_navbar.php'; ?>
<?php if (isset($page_heading)): ?>
    <section class="section section_header">
        <div class="container">
            <div class="row">
                <div class="col-sm-12">
                    <h1 class="section__heading section_header__heading text-center"><?= $page_heading ?></h1>
                    <ol class="breadcrumb">
                        <li><a href="/">Главная</a></li>
                        <li class="active"><?= isset($page_crumb) ? $page_crumb : $page_heading ?></li>
                    </ol>
                </div>
            </div>
        </div>
        <div class="section_header__bg hero_<?= $page_hero ?>"></div>
    </section>
<?php endif; ?>
