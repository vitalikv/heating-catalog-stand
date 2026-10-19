# heating-catalog-stand

Независимый стенд для переноса и проверки параметрических моделей отопления
из старого проекта `3d-stroyka/gl2` и библиотека генераторов `src/lib` для редактора
`skeleton-wf/src-heating`.

Документация — [карта документов](docs/README.md). Главное:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — устройство библиотеки, контракт, как добавить генератор;
- [docs/library-usage.md](docs/library-usage.md) — как пользоваться библиотекой и освобождать ресурсы;
- [docs/roadmap.md](docs/roadmap.md) — открытые задачи;
- [docs/catalog-expansion-plan.md](docs/catalog-expansion-plan.md) — реестр, карточки и чек-листы новых позиций;
- [docs/transfer/README.md](docs/transfer/README.md) — пакет и подключение к редактору.

Не требует OpenServer, PHP или БД и не импортирует код соседних проектов.

## Запуск

```bash
npm install
npm run dev        # стенд в браузере
npm run typecheck  # строгая проверка типов (стенд + библиотека без DOM)
npm test           # тесты генераторов в node
npm run build      # проверка типов и сборка в dist/
npm run build:lib  # пакет библиотеки и архив npm pack в dist-lib/ (lib-package/README.md)
npm run verify:lib # проверка архива на чистой установке
```

## Структура

На стенде папка «Каталог» позволяет выбрать группу, объект и набор параметров.
Группы: стальные детали, полипропилен, металлопластик, радиаторы и комплектующие,
арматура, оборудование. «Все группы» показывает полный список объектов.
Выбор объекта открывает его в 3D; параметры можно менять и сбрасывать к выбранному набору.

- `src/lib` — библиотека генераторов: 88 генераторов — весь каталог `gl2` (40) и новые модели,
  855 позиций каталога и 7 готовых узлов (`ASSEMBLY_RECIPES`).
  Новые позиции и ограничения — [docs/catalog-extensions.md](docs/catalog-extensions.md) и
  [docs/catalog-expansion-plan.md](docs/catalog-expansion-plan.md). Не обращается к `window`,
  `document` и рендереру: `tsconfig.lib.json` проверяет её без DOM,
  поэтому генераторы пригодны для воркера редактора.

  ```text
  src/lib/
    index.ts      публичный API — единственная точка импорта для стенда и редактора
    core/         контракт (ModelGenerator, GeneratedModel, Connector), BaseGenerator,
                  разъёмы (connector, ConnectorFrame), createMeshModel
    params/       ParamSchema, общие описания параметров specs
    sizes/        таблицы размеров: ThreadSizes, PpPipeSizes, MpPipeSizes
    geometry/     построители кусков геометрии и слияние по материалам
    materials/    MaterialLibrary — материалы по ключам; loadMaterialTextures — текстуры
    scene/        createModelObject — модель + материалы → объект сцены
    assembly/     ConnectorMating, Assembly — стыковка и сборки; recipes/ — готовые узлы
    catalog/      позиции каталога (CATALOG) по семействам
    generators/   steel/, pp/, mp/, radiator/, valve/, equipment/, manifold/; GeneratorRegistry
    legacy/       перевод ID и параметров gl2 — только для сверки
  ```

  Стенд импортирует только `src/lib/index.ts`; тесты могут брать внутренние модули напрямую.
- `src/stand` — просмотр: сцена, панель параметров по каталогу, сборки для проверки стыковки, диагностика.
  Свет и камера повторяют `src-heating`: `AmbientLight` 0.5π,
  `DirectionalLight` 1.5 у камеры, FOV 75.
- `tests` — тесты vitest в среде node; `tests/fixtures/gl2-reference.json` —
  эталон моделей `gl2` для теста `gl2Reference`, `tests/fixtures/gl2Presets.ts` — наборы
  `start.js` в формате `gl2` (исходник каталога и сверки).
- `scripts` — сборка и проверка пакета (`build-lib.mjs`, `verify-lib-package.mjs`,
  `lib-worker-check.mjs`), сверка с `gl2` через headless Chrome (`gl2-compare.mjs`, `gl2-snapshot.mjs`)
  и снимок новых моделей (`extensions-snapshot.mjs`). Для сверки нужны `gl2` в OpenServer,
  `npx vite --port 5199` и Chrome с CDP; для обычной работы и тестов не нужны.
  Порядок — [docs/gl2-verification.md](docs/gl2-verification.md).

## Версии

`three` и `@types/three` зафиксированы на `0.182.0`, как в `skeleton-wf`.
Перед подключением библиотеки к редактору версии сверяются заново.

## Источники ресурсов

| Файл | Источник |
| --- | --- |
| `public/textures/rezba_1.png` | `3d-stroyka/gl2/img/obj/rezba_1.png` — текстура резьбы (материал `thread`) |
| `public/textures/manometr.png` | `3d-stroyka/gl2/img/obj/manometr.png` — циферблат манометра (материал `manometer`) |
