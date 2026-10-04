#!/bin/sh
# Кладёт библиотеку Three.js в assets/vendor/three/<версия>/ — без CDN и без node_modules в проекте.
# Запуск из корня сайта:  sh tools/vendor-three.sh
# Версия зафиксирована: 0.185.1 — последняя, в которой есть сжатые сборки (three.module.min.js).
# При обновлении поменяйте VERSION и INTEGRITY (npm view three@<версия> dist.integrity),
# а затем путь и хэши в menu.php.
set -eu

VERSION="0.185.1"
INTEGRITY="sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg=="

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/vendor/three/$VERSION"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
npm pack "three@$VERSION" --silent >/dev/null
TARBALL="three-$VERSION.tgz"

# Архив должен совпасть с контрольной суммой из реестра npm
ACTUAL="sha512-$(openssl dgst -sha512 -binary "$TARBALL" | openssl base64 -A)"
if [ "$ACTUAL" != "$INTEGRITY" ]; then
    echo "Контрольная сумма архива не совпала: $ACTUAL" >&2
    exit 1
fi

tar -xzf "$TARBALL" package/build/three.module.min.js package/build/three.core.min.js package/LICENSE
mkdir -p "$DEST"
cp package/build/three.module.min.js package/build/three.core.min.js package/LICENSE "$DEST/"

sri() {
    echo "sha384-$(openssl dgst -sha384 -binary "$1" | openssl base64 -A)"
}

{
    echo "three@$VERSION — https://registry.npmjs.org/three/-/three-$VERSION.tgz"
    echo "Архив: $INTEGRITY"
    echo "three.module.min.js: $(sri "$DEST/three.module.min.js")"
    echo "three.core.min.js:   $(sri "$DEST/three.core.min.js")"
} > "$DEST/PROVENANCE.txt"

cat "$DEST/PROVENANCE.txt"
