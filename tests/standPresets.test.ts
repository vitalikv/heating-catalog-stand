import { describe, expect, it } from 'vitest';
import { STAND_PRESETS } from '../src/stand/presets';

describe('наборы стенда', () => {
  it('подписи наборов генератора уникальны: панель выбирает набор по подписи', () => {
    for (const entry of STAND_PRESETS) {
      const labels = entry.presets.map((preset) => preset.label);
      expect(new Set(labels).size, entry.generatorId).toBe(labels.length);
    }
  });
});
