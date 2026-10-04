# ФабрикантЪ — сайт ресторана-пивоварни

Сайт ресторана с собственной пивоварней в Симферополе: [fabrikant-simf.ru](https://fabrikant-simf.ru).
PHP без фреймворка и без базы данных: страницы в корне, общие части в `inc/`, данные в `data/`.

## Запуск локально

Laravel Herd (или любой PHP 8.x с GD и WebP): папка сайта → `http://fabrikant.test`.

## Чего нет в репозитории

- `uploads/*.pdf` — PDF меню. Делаются из PDF типографии: `php tools/new-menu.php файл.pdf имя "Сезон"`
  (нужен `brew install poppler`).
- `assets/video/` — фоновое видео главной (`video_bg-v2.mp4`), взять у владельца.
- `docs/private/` — доступы к хостингу.
- Рабочие документы (`TZ-laravel.md`, `instrukcia.html`, `audit.html`) и `.well-known/` — только локально.

## Проверки

```sh
node --test tools/tests/
```
