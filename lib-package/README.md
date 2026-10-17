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
| `manifest.json` | Версия пакета, версия three и список генераторов: ID и версия |

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
- ID генератора после появления сохранённых проектов не меняется.

## Выпуск

На стенде: `npm run typecheck`, `npm test`, затем `npm run build:lib`
(архив в `dist-lib/`) и `npm run verify:lib` (проверка архива на чистой установке
и в настоящем web worker через headless Chrome).
