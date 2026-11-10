# 0006. Обязательные проверки качества в CI

- Статус: принято
- Дата: 2026-11-07
- PR: [#1](https://github.com/akoody/Capy/pull/1), [#3](https://github.com/akoody/Capy/pull/3), [#4](https://github.com/akoody/Capy/pull/4)

## Контекст
Проект начинался без CI. Тесты были шаблонными (`Hello World` на несуществующем маршруте), ESLint с `recommendedTypeChecked` находил 602 ошибки, TypeScript работал без `strict`.

## Решение
CI ([ci.yml](../../.github/workflows/ci.yml)) на каждый PR и push в `main`:
- **API:** `format:check` (Prettier), `lint` (ESLint, `--max-warnings=0`), `typecheck` (`strict: true`), unit-тесты, сборка;
- **API e2e:** весь `AppModule` на `mongo:7`, каждая прогонка в отдельной базе;
- **Web:** typecheck и сборка фронта.

Правила для тестов ослаблены точечно: `no-unsafe-member-access`, `no-unsafe-assignment` и `unbound-method` выключены только в `*.spec.ts` и `test/`, потому что тело ответа supertest имеет тип `any`, а `expect(mock.method)` это штатный приём jest.

Чисто форматирующие коммиты перечислены в `.git-blame-ignore-revs`.

## Рассмотренные варианты
- **Включить линтер постепенно, через baseline**: быстрее, но на старте 602 ошибки, и большинство сидело в коде, который всё равно стоило переписать (см. [0004](0004-llm-provider-chains.md)).
- **e2e на mongodb-memory-server**: не нужен Docker, но это не тот же сервер, что в продакшене, и нет транзакций без отдельной настройки replica set.

## Последствия
- Любой PR, ломающий типы, стиль или доступ к данным, не проходит CI.
- Squash и rebase на GitHub создают новые SHA и ломают `.git-blame-ignore-revs`, поэтому PR мержим merge-коммитом.
