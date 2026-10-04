# ФабрикантЪ — сайт ресторана-пивоварни

Сайт ресторана с собственной пивоварней в Симферополе: [fabrikant-simf.ru](https://fabrikant-simf.ru).
PHP без фреймворка и без базы данных: страницы в корне, общие части в `inc/`, данные в `data/`.

## Запуск локально

Laravel Herd (или любой PHP 8.x с GD и WebP): папка сайта → `http://fabrikant.test`.

## Документация

- [`instrukcia.html`](instrukcia.html) — структура папок, выкладка на хостинг, обновление меню, акции.
- [`TZ-laravel.md`](TZ-laravel.md) — техзадание на переезд на Laravel с админкой.
- [`audit.html`](audit.html) — UX-аудит страницы меню.

## Чего нет в репозитории

- `uploads/*.pdf` — PDF меню. Делаются из PDF типографии: `php tools/new-menu.php файл.pdf имя "Сезон"`
  (нужен `brew install poppler`).
- `assets/video/` — фоновое видео главной (`video_bg-v2.mp4`), взять у владельца.
- `docs/private/` — доступы к хостингу.

## Проверки

```sh
node --test tools/tests/
```
