import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { MpCompressionEnd } from './MpCompressionEnd';
import type { CompressionSize } from './MpCompressionEnd';

export interface MpEuroconeAdapterParams {
  /** Наружный диаметр МП-трубы, мм, строкой: VT.4420 выпускается 16(2,0) и 20(2,0). */
  pipeNominal: string;
  /** Резьба накидной гайки евроконуса. */
  euroconeNominal: string;
  /** Общая длина L — от конуса штуцера до конца хвостовика, м (VT.4420: 26 мм). */
  length: number;
}
type Layout = { pipe: CompressionSize; eurocone: ThreadedSize };

/**
 * Доли общей длины L по эскизу VALTEC (технический каталог 2017, с. 206, VT.4420):
 * конус штуцера перед гайкой, корпус гайки с резьбой, шестигранник, хвостовик штуцера за гайкой.
 */
const SHARE = { cone: 0.06, barrel: 0.51, hex: 0.2 };
/** Корпус гайки к резьбе 3/4 и шестигранник (по вершинам) к корпусу — по эскизу. */
const BARREL_RATIO = 1.16;
const HEX_RATIO = 0.92;
/** Уплотнительные кольца штуцера, м. */
const O_RING = 0.0015;

/**
 * Фитинг евроконуса на МП-трубу (позиция 63) по образцу VALTEC VT.4420. Длина L и ряд труб —
 * по таблице каталога, доли частей — по эскизу (чертежа с размерами деталей нет).
 * Никелированная накидная гайка: спереди корпус с внутренней резьбой 3/4 навинчивается на
 * наружный евроконус, сзади шестигранник. Латунный штуцер проходит насквозь: спереди конус
 * с кольцом входит в выход евроконуса, сзади на хвостовик надевается труба; разрезное
 * кольцо внутри шестигранника обжимает её. Система трубы — mp-compression.
 * Заготовка по X: конус слева, хвостовик справа.
 */
export class MpEuroconeAdapterGenerator extends BaseGenerator<MpEuroconeAdapterParams, Layout> {
  readonly id = 'mp.eurocone-adapter';
  readonly version = 1;
  readonly title = 'Адаптер евроконуса на МП-трубу';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'pipeNominal', label: 'Труба, мм', options: ['16', '20'] },
    { kind: 'choice', key: 'euroconeNominal', label: 'Евроконус', options: ['3/4'] },
    { kind: 'length', key: 'length', label: 'Длина L', min: 0.022, max: 0.032, step: 0.0005 },
  ];
  readonly defaults: MpEuroconeAdapterParams = { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 };

  protected override layout(p: MpEuroconeAdapterParams): Layout {
    return { pipe: MpCompressionEnd.size(p.pipeNominal), eurocone: threadedSize(p.euroconeNominal, 'internal') };
  }

  protected create(p: MpEuroconeAdapterParams, d: Layout): GeneratedModel {
    const { pipe, eurocone } = d;
    const cone = p.length * SHARE.cone;
    const barrel = p.length * SHARE.barrel;
    const hex = p.length * SHARE.hex;
    const tail = p.length - cone - barrel - hex;
    // Отметки по X: начало конуса, торец гайки, граница корпуса и шестигранника, задний торец гайки, конец хвостовика.
    const start = -p.length / 2;
    const nutFront = start + cone;
    const nutStep = nutFront + barrel;
    const nutBack = nutStep + hex;
    const end = p.length / 2;
    const barrelOuter = eurocone.n * BARREL_RATIO;
    // Конус и кольцо штуцера проходят внутри резьбы евроконуса (наружная 3/4: канал 21,2 мм).
    const headOuter = threadedSize(p.euroconeNominal, 'external').v - 0.001;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const span = (from: number, to: number) => ({ length: to - from, center: at((from + to) / 2) });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Гайка: корпус с резьбой 3/4 и шестигранник с отверстием под разрезное кольцо; между ними внутренний уступ.
      ...sleeves.build({ material: 'metal', ...span(nutFront, nutStep), outerDiameter: barrelOuter, innerDiameter: eurocone.v,
        materials: { inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...span(nutStep, nutBack), outerDiameter: barrelOuter * HEX_RATIO, innerDiameter: pipe.nutInner,
        outerSegments: 6, materials: { outer: 'metalFlat' } }),
      // Штуцер: конус спереди, уплотнительное кольцо, стержень под трубу до конца хвостовика.
      ...sleeves.build({ material: 'bronze', ...span(start, nutFront + O_RING), outerDiameterStart: pipe.insertOuter + 0.002,
        outerDiameter: headOuter, innerDiameter: pipe.channel }),
      ...sleeves.build({ material: 'black', ...span(nutFront + O_RING, nutFront + 2 * O_RING), outerDiameter: headOuter,
        innerDiameter: pipe.insertOuter }),
      ...sleeves.build({ material: 'bronze', ...span(nutFront + 2 * O_RING, end), outerDiameter: pipe.insertOuter,
        innerDiameter: pipe.channel }),
      // Кольцо на хвостовике под трубой и разрезное кольцо в шестиграннике.
      ...sleeves.build({ material: 'black', ...span(end - tail / 2 - O_RING / 2, end - tail / 2 + O_RING / 2),
        outerDiameter: pipe.insertOuter + 0.0008, innerDiameter: pipe.insertOuter }),
      ...sleeves.build({ material: 'bronze', ...span(nutStep, nutBack), outerDiameter: pipe.nutInner, innerDiameter: pipe.pipe }),
    );
    return createMeshModel({
      title: `Адаптер евроконус ${p.euroconeNominal} x МП ${p.pipeNominal}`,
      ...merger.merge(),
      connectors: [
        // Торец гайки; резьба гайки навинчивается на евроконус на всю длину корпуса.
        connector('eurocone', ConnectorFrame.left, -nutFront, { depth: barrel, nominal: p.euroconeNominal, joint: 'eurocone', gender: 'internal' }),
        // Конец хвостовика: труба надевается на него до корпуса гайки.
        connector('pipe', ConnectorFrame.right, end, { depth: end - nutStep, nominal: p.pipeNominal, joint: 'mp-compression', gender: 'internal' }),
      ],
    });
  }
}
