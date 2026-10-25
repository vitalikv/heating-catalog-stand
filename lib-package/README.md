# @ingplan/heating-generators

Параметрические генераторы деталей отопления для three.js: модели как данные,
материалы по ключам, стыковка, сборки и каталог. Собирается из `src/lib`
стенда `heating-catalog-stand` и ставится в редактор архивом `npm pack`.

## Что внутри

| Файл | Что это |
| --- | --- |
| `index.js` | ESM-модуль библиотеки; `three` в него не входит |
| `types/` | Декларации типов; точка входа `types/index.d.ts` |
| `textures/*.png` | Текстуры материалов (таблица ниже) |
| `manifest.json` | Версия пакета, версия three, списки генераторов и рецептов сборок: ID, версия, ключи исполнений |

Импорт — только из корня пакета: `import { GeneratorRegistry } from '@ingplan/heating-generators'`.
Внутренние модули (классы генераторов, геометрия) наружу не открыты.

## Зависимости

`three` — peer-зависимость `~0.182.0`: движок ставит редактор, второй копии
в пакете нет. Типам нужен `@types/three` той же версии.

## Использование

```ts
import { GeneratorRegistry, MaterialLibrary, createModelObject } from '@ingplan/heating-generators';

const registry = new GeneratorRegistry();
const materials = new MaterialLibrary();          // один на сцену
const generator = registry.get('steel.coupling');
const errors = generator.validate(params);        // [] — параметры годятся
const model = generator.build(params);            // данные: геометрия, ключи материалов, разъёмы
const object = createModelObject(model, materials);
// ...
model.dispose();       // геометрию освобождает модель
materials.dispose();   // материалы и текстуры — владелец библиотеки, при закрытии сцены
```

Генераторы не обращаются к DOM и работают в воркере.

## Готовые узлы

`ASSEMBLY_RECIPES` — производственные рецепты сборок: `id` (`assembly.pump-module`),
`version`, `title`, необязательные исполнения `variants` (`{ key, label }`, например
число выходов коллектора) и `build(key?)`, который отдаёт новое `AssemblyDefinition`;
без ключа — первое исполнение. Каждый рецепт — одна связанная группа: все детали
присоединены друг к другу (`attach`), явное положение — только у первой.

| ID | Узел | Исполнения |
| --- | --- | --- |
| `assembly.pump-module` | насосный модуль прямой 1" | — |
| `assembly.pump-mixing-module` | насосный модуль со смесительным клапаном 1" | — |
| `assembly.manifold-supply` | коллектор подающий с расходомерами в сборе | выходов 3–12 |
| `assembly.manifold-return` | коллектор обратный под сервоприводы в сборе | выходов 3–12 |
| `assembly.radiator-h-block` | радиатор стальной с H-блоком | справа или слева, с кранами или без |
| `assembly.mixing-unit` | насосно-смесительный узел тёплого пола | — |
| `assembly.boiler-cold-inlet` | вход холодной воды в бойлер с группой безопасности | — |
| `assembly.radiator-side` | радиатор стальной 1000 × 500 с боковой обвязкой (0.6.0) | слева, справа, диагональ слева или справа |

Обвязка любого радиатора — `radiatorPipework(radiator, options)` (0.6.0): радиатор
(`radiator.steel` или `radiator.aluminium` с его параметрами) и подключение — боковое,
диагональное, нижнее (H-блок) или инжекторное; сторона, клапаны угловые или прямые,
подача (термоклапан с головкой, кран, без), обратка (запорный клапан, кран, без), труба
МП 16/20 или ПП 20/25 (нижнее и инжекторное — только МП). Отдаёт `definition` — узел,
первая деталь которого `радиатор`, — и разъёмы под трубу подачи и обратки (`supply`,
`return`: имя детали и разъём). Тройников магистрали в узле нет.

Собирает узел `Assembly`: модели и матрицы деталей в координатах узла,
проверенные стыки и замыкания.

```ts
import { ASSEMBLY_RECIPES, Assembly } from '@ingplan/heating-generators';

const recipe = ASSEMBLY_RECIPES.find((r) => r.id === 'assembly.pump-module');
const assembly = new Assembly(registry, recipe.build());
// assembly.parts: { name, model, matrix }[]; assembly.joints, assembly.errors
assembly.dispose();
```

Имена деталей в рецепте — часть его версии: по ним узел сопоставляется
с деталями и свободными разъёмами.

## Текстуры

Файлы лежат в пакете, чтобы версии кода и ресурсов не расходились; список по
ключам — `MATERIAL_TEXTURE_FILES`. Загружает их `loadMaterialTextures` —
одинаково в главном потоке и в воркере (ImageBitmapLoader, без DOM). Адрес
файла даёт потребитель; в Vite:

```ts
import threadUrl from '@ingplan/heating-generators/textures/rezba_1.png?url';
// ... так же остальные три
const urls = { 'rezba_1.png': threadUrl, /* ... */ };
const { failed } = await loadMaterialTextures(materials, (file) => urls[file]);
```

Текстуры переходят во владение `MaterialLibrary` вместе с `ImageBitmap`:
замена и `dispose()` закрывают bitmap, текстура после `dispose()` освобождается
сразу. Не загрузившаяся текстура оставляет материал без карты и попадает
в `failed`. Задать текстуру вручную по-прежнему можно (`setThreadTexture`,
`setManometerTexture`, `setDialTexture`).

| Файл | Материал | Источник |
| --- | --- | --- |
| `rezba_1.png` | `thread`, резьба | `3d-stroyka/gl2/img/obj/rezba_1.png` |
| `manometr.png` | `manometer`, циферблат манометра | `3d-stroyka/gl2/img/obj/manometr.png` |
| `termometr.png` | циферблат термометра, 0…120 °C | нарисован на стенде в компоновке `manometr.png` |
| `termomanometr.png` | циферблат термоманометра, 0…6 бар и 0…120 °C | нарисован на стенде в компоновке `manometr.png` |

## Версии

- **Версия пакета** — в `package.json`; растёт с каждым выпуском.
- **Версия генератора** — `generator.version`, хранится в проекте вместе
  с параметрами детали. Список — `manifest.json`.
- **Версия рецепта** — `recipe.version`; растёт, когда меняются состав или
  положение деталей узла. Список — `manifest.json`.
- ID генератора и рецепта после появления сохранённых проектов не меняется.

## Выпуск

На стенде: `npm run typecheck`, `npm test`, затем `npm run build:lib`
(архив в `dist-lib/`) и `npm run verify:lib` (проверка архива на чистой установке
и в настоящем web worker через headless Chrome).
