# Статическая поставка frontend

Сборка полностью выполняется на Mac в локальном Docker. На production копируется только содержимое `dist/` и эта документация; Node, Vite, npm, исходники, node_modules, тесты, .env и Docker-файлы серверу не нужны.

## Локальная сборка

В общем workspace BMS_Monitor:

```sh
./bin/sync-contract --check
docker compose exec -T frontend sh -c 'npm run check:generated && npm run lint:contract && npm run lint && npm run typecheck && npm test && npm run build'
```

Для отдельно полученного frontend-репозитория, из его корня, с Docker и меткой текущей локальной сессии:

```sh
docker run --rm --label "ao.session=${AO_SESSION_ID:?}" --memory 512m --cpus 1 \
  -v "$PWD:/app" -w /app node:22-alpine \
  sh -c 'npm ci && npm run check:generated && npm run lint:contract && npm run lint && npm test && npm run build'
```

`build` включает проверку TypeScript. Не менять lock-файл на сервере и не использовать Vite dev/preview как production-сервер. Известное ограничение инструментов: на предыдущей проверке picomatch 4.0.7 имел GHSA-fc5q-39xc-vjpf; наличие готового исправления проверяется отдельно перед поставкой. Это относится к цепочке локальной сборки, а не к серверному Node-процессу: такого процесса нет.

## Размещение

Целевой каталог `/home/lex/www/bms_monitor/frontend`:

```text
frontend/
  public/
    index.html
    assets/...
  docs/deployment.md
  README.md
  SHA256SUMS
```

`public/` содержит ровно результат сборки `dist/`. Nginx root должен указывать на `frontend/public`, не на весь каталог проекта. `SHA256SUMS` фиксирует файлы поставки и позволяет сверить передачу командой `sha256sum -c SHA256SUMS` из frontend. Документация и манифест не предназначены для веб-раздачи. Существующие файлы соседних проектов не затрагиваются.

Сборка рассчитана на корень выбранного origin, например `http://192.168.1.5:SITE_PORT/`. Порт определяет DevOps. API и Mercure доступны на этом же origin; в JS нет адреса Docker backend или JWT. Сборка не требует production-паролей и не зависит от выбранного порта сайта.

## Маршруты для DevOps

| Путь | Обработка |
| --- | --- |
| `/` | `public/index.html` |
| `/assets/*` | Существующий файл из public/assets; отсутствующий — 404 |
| `/api/*` | Backend PHP-FPM; не заменять ответы на index.html |
| `GET /.well-known/mercure` | Нативный Mercure hub; query сохраняется, буферизация/кеш отключены |

Для index.html — перепроверка кеша при открытии (`Cache-Control: no-cache`). Для файлов с хешем в assets допустим длительный immutable-кеш. SSE — длительное соединение с heartbeat, а не обычный короткий HTTP-ответ; POST к публичному пути Mercure не разрешать. Подробности переменных, сервера и издателя — `backend/docs/deployment.md` в отдельном backend checkout.

## Поведение и проверка

Frontend подписывается на `urn:bms:battery:sacred-sun-monitor-01`, получает `/api/v1/telemetry/state`, отдельно — снимок покрытия истории последних 10 минут. По SSE принимает `telemetry.updated.v1`. При восстановлении соединения повторно получает снимок. Постоянного опроса latest каждые 5 секунд нет.

Пауза источника — нормальное «Нет новых измерений» с пробелами истории; неизвестные показатели не заменяются нулями. Работоспособность hub не доказывает наличие данных батареи. Нет пользователей/паролей приложения: доступ ограничивается внутренней сетью на сервере.

После настройки DevOps проверяет загрузку index/assets, правильные JSON-ответы API, SSE и обновление по реальному пакету. До настройки backend/hub загруженный интерфейс может показывать ошибку связи — простое копирование файлов не запускает систему. Дизайн, эмулятор, годовые отчёты и доработка монитора в эту поставку не входят.
