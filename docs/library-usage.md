# Использование библиотеки

Как подключить генераторы к своему коду: построить деталь, показать её в сцене, освободить
ресурсы. Устройство и контракт — [ARCHITECTURE.md](ARCHITECTURE.md), поставка пакетом —
[`lib-package/README.md`](../lib-package/README.md), подключение к редактору — [transfer/README.md](transfer/README.md).

Импорт — только из точки входа: на стенде `src/lib/index.ts`, в редакторе — пакет
`@ingplan/heating-generators`. Примеры ниже написаны для пакета; на стенде меняется только путь импорта.
Они проверены компилятором TypeScript на текущем API (п. 9).

## 1. Генератор и параметры

```ts
import { GeneratorRegistry, MaterialLibrary, createModelObject } from '@ingplan/heating-generators';

const registry = new GeneratorRegistry();   // без аргументов и без состояния
const materials = new MaterialLibrary();    // один на сцену

const coupling = registry.get('steel.coupling');      // ModelGenerator<SteelCouplingParams>
const params = structuredClone(coupling.defaults);    // defaults общие: менять копию
params.nominalRight = '3/4';

const errors = coupling.validate(params);             // [] — параметры годятся
if (errors.length === 0) {
  const model = coupling.build(params);               // данные: геометрия, ключи материалов, разъёмы
  const object = createModelObject(model, materials); // Group с одним Mesh
}
```

- `registry.get('steel.coupling')` с ID-литералом типизирован: тип параметров выводится из реестра.
- Параметры — простые данные: строки номиналов, длины в метрах, вложенные объекты.
  Вложенный параметр адресуется путём: `ParamSpec.key` и `ValidationError.param` — `'dimensions.y'`,
  прочитать его можно `ParamSchema.get(params, 'dimensions.y')`.
- Одинаковые параметры дают одинаковую модель; генератор не меняет переданные параметры.
- `defaults` проходят `validate()` — с ними деталь вставляется по умолчанию.

### Позиции каталога

```ts
import { CATALOG } from '@ingplan/heating-generators';

for (const entry of CATALOG) {
  const generator = registry.get(entry.generatorId);
  for (const item of entry.items) {
    // item.label — подпись позиции ('1/2 × 1/2, 30 мм'), item.params — параметры генератора
    const model = generator.build(item.params);
    model.dispose();
  }
}
```

Позиции проверяются тестами стенда: каждая проходит схему своего генератора.

## 2. Данные проекта и ошибки

В проекте деталь хранится как `{ generatorId, version, params }`. ID из файла — просто строка:
такой `get` возвращает `ModelGenerator<unknown> | undefined`.

```ts
import { GeneratorParamsError, type GeneratedModel } from '@ingplan/heating-generators';

interface SavedPart { generatorId: string; version: number; params: unknown }

function buildSaved(part: SavedPart): GeneratedModel | string {
  const generator = registry.get(part.generatorId);
  if (!generator) return `неизвестная модель ${part.generatorId}`;
  if (part.version > generator.version) return `модель новее библиотеки: ${part.version} > ${generator.version}`;
  const errors = generator.validate(part.params);
  if (errors.length > 0) return errors.map((error) => `${error.param}: ${error.message}`).join('; ');
  return generator.build(part.params);
}

try {
  coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.001 });
} catch (error) {
  if (!(error instanceof GeneratorParamsError)) throw error;
  // error.generatorId — 'steel.coupling', error.errors — те же ValidationError, что дал бы validate()
}
```

- `build()` с негодными параметрами бросает `GeneratorParamsError`. Чтобы не ловить исключение,
  сначала вызывают `validate()`.
- Параметры прежней версии генератора, где не было параметров с `ParamSpec.addedIn`, библиотека
  дополняет их значениями из `defaults` — и в `validate()`, и в `build()`. Принимать ли старую
  версию детали, решает потребитель: редактор пока требует точного совпадения версии и
  ставит деталь-заглушку. Перевода несовместимых параметров между версиями (`migrate`) нет —
  [roadmap.md](roadmap.md).

## 3. Текстуры

```ts
import { loadMaterialTextures } from '@ingplan/heating-generators';
import threadUrl from '@ingplan/heating-generators/textures/rezba_1.png?url';
import manometerUrl from '@ingplan/heating-generators/textures/manometr.png?url';
import thermometerUrl from '@ingplan/heating-generators/textures/termometr.png?url';
import thermomanometerUrl from '@ingplan/heating-generators/textures/termomanometr.png?url';

const urls: Record<string, string> = {
  'rezba_1.png': threadUrl,
  'manometr.png': manometerUrl,
  'termometr.png': thermometerUrl,
  'termomanometr.png': thermomanometerUrl,
};
const { failed } = await loadMaterialTextures(materials, (file) => urls[file]);
if (failed.length > 0) console.warn('текстуры не загрузились', failed);
```

Загрузчик работает и в главном потоке, и в воркере (`ImageBitmapLoader`, без DOM). Промис
не отклоняется: что не загрузилось — в `failed`, материал остаётся без карты (резьба гладкая,
циферблат белый). Стенд передаёт адрес по `import.meta.env.BASE_URL + 'textures/' + file`.
Модели можно строить и показывать до конца загрузки: текстура появится у материала позже.

## 4. Удаление детали и закрытие сцены

```ts
import type { Scene } from 'three';

function removePart(scene: Scene, object: ReturnType<typeof createModelObject>, model: GeneratedModel): void {
  scene.remove(object);
  model.dispose();      // геометрия модели; повторный вызов безопасен
}

function closeScene(): void {
  // сначала удалить все детали (removePart), затем:
  materials.dispose();  // материалы и все текстуры вместе с ImageBitmap
}
```

Не вызывать `geometry.dispose()` и `material.dispose()` у мешей объекта вручную:
у геометрии и материалов есть владельцы (п. 5).

## 5. Кто чем владеет

| Ресурс | Владелец | Когда освобождается |
| --- | --- | --- |
| `BufferGeometry` модели | `GeneratedModel` | `model.dispose()` |
| Объект сцены (`Group` + `Mesh`) | потребитель | удалить из сцены; своих GPU-ресурсов у него нет |
| Материалы | `MaterialLibrary` | `materials.dispose()` |
| Текстуры, переданные в `MaterialLibrary` или загруженные `loadMaterialTextures` | `MaterialLibrary` | при замене текстуры того же ключа и в `materials.dispose()`, вместе с `ImageBitmap` |
| Модели деталей сборки | `Assembly` | `assembly.dispose()` |

- `createModelObject` не копирует геометрию: меш объекта ссылается на `model.geometry`.
  Поэтому модель освобождают после того, как объект убран из сцены.
- Несколько объектов из одной модели (`createModelObject` дважды) делят одну геометрию.
  `model.dispose()` вызывают один раз, когда убран последний из них. Счётчика владельцев
  и кэша моделей в библиотеке нет — это задача потребителя ([roadmap.md](roadmap.md)).
- Текстура, пришедшая после `materials.dispose()` (загрузка закончилась после закрытия сцены),
  освобождается сразу.

## 6. Сборки и готовые узлы

```ts
import { ASSEMBLY_RECIPES, Assembly } from '@ingplan/heating-generators';

const recipe = ASSEMBLY_RECIPES.find((item) => item.id === 'assembly.manifold-supply')!;
const assembly = new Assembly(registry, recipe.build(recipe.variants?.[0].key));

for (const part of assembly.parts) {
  const object = createModelObject(part.model, materials);
  part.matrix.decompose(object.position, object.quaternion, object.scale);
}
const problems = [
  ...assembly.errors,
  ...assembly.joints.filter((joint) => !joint.check.compatible).map((joint) => joint.label),
  ...assembly.closures.filter((closure) => !closure.closed).map((closure) => closure.label),
];
assembly.dispose();   // освобождает модели всех деталей
```

Что делает `Assembly` и чего не делает — [ARCHITECTURE.md](ARCHITECTURE.md), п. 8.
Имена деталей рецепта (`part.name`) — часть его версии: по ним потребитель находит детали
и свободные разъёмы узла.

## 7. Стыковка двух деталей

```ts
import { ConnectorMating } from '@ingplan/heating-generators';
import { Matrix4 } from 'three';

const nipple = registry.get('steel.nipple').build(registry.get('steel.nipple').defaults);
const fixed = coupling.build(coupling.defaults);
const check = ConnectorMating.check(fixed.connectors[1], nipple.connectors[0]);
if (check.compatible) {
  // матрица ниппеля, при которой его разъём сидит в разъёме муфты; угол — радианы
  const matrix = ConnectorMating.place(fixed.connectors[1], new Matrix4(), nipple.connectors[0], 0);
}
```

`check` сообщает причину несовместимости (`reason`: `joint`, `nominal`, `gender`) и глубину посадки.

## 8. Воркер

Генераторы не обращаются к `window`, `document` и рендереру, поэтому работают в web worker.
Но `GeneratedModel` — не транспортный формат: в ней `BufferGeometry` и метод `dispose()`.
Готовой сериализации модели для передачи между потоками в библиотеке нет. Редактор её
и не требует: модели строятся и рисуются в одном воркере сцены, через сообщения ходят
только ID, параметры и положения. Если понадобится строить в одном потоке, а рисовать в другом,
передавать нужно атрибуты геометрии (transferable-буферы), группы материалов, ключи материалов,
разъёмы, габарит, название и предупреждения — это требование к будущему адаптеру, а не
существующий API ([roadmap.md](roadmap.md)).

## 9. Проверка примеров

19 октября 2026 примеры п. 1–7 собраны в один файл с импортом из `src/lib/index.ts` и проверены
`tsc` с настройками `tsconfig.json` стенда (`strict`, DOM, `vite/client` для импортов `?url`).
