# BMS Monitor — frontend

React / строгий TypeScript. Живой экран батареи получает снимок через HTTP и обновления через Mercure. Production — только статические файлы, без Node/Vite/Docker.

Репозиторий: `git@github.com:lexwm/bms_monitor_forntend.git`.

- [Сборка, поставка и маршруты для DevOps](docs/deployment.md).
- [Снимок OpenAPI backend](contracts/openapi.json). Это копия, не самостоятельный источник контракта.
- [Правила разработки](AGENTS.md).

Локальная совместная разработка: `./bin/up` и `./bin/check` из корня workspace BMS_Monitor. Frontend может быть собран отдельно: все необходимые файлы входят в его репозиторий. Node 22, зависимости строго из `package-lock.json`; инструкции сборки находятся в deployment.md.

При изменении API скопировать `contracts/openapi.json` из backend в `contracts/openapi.json` этого репозитория (в общем workspace `./bin/sync-contract`), затем выполнить `npm run generate:api` через локальный контейнер. `npm run check:generated` проверяет соответствие типов/схем снимку. Общая проверка workspace дополнительно проверяет идентичность снимка backend. Generated-файлы не редактировать вручную.
