import { describe, expect, it } from 'vitest';

import {
  evaluateAgainstGhost,
  evaluateCyclingKneeBdc,
  evaluateCyclingKneeTracking,
  evaluateCyclingPelvicRocking,
  evaluateMetrologicalQuality,
  evaluateRunningCadence,
  evaluateRunningKneeValgus,
  evaluateRunningPelvicDrop,
  evaluateRunningStepWidth,
  trafficLightBadgeClasses,
  trafficLightLabel,
} from '../lib/traffic-light';

describe('evaluateMetrologicalQuality', () => {
  it('classifies high confidence and coverage as high signal', () => {
    const res = evaluateMetrologicalQuality(0.85, 0.92);
    expect(res.level).toBe('green');
    expect(res.qualityBand).toBe('high');
    expect(res.title).toContain('alta');
    expect(res.description).toContain('no representa un margen');
  });

  it('classifies intermediate values as usable', () => {
    const res = evaluateMetrologicalQuality(0.72, 0.78);
    expect(res.level).toBe('yellow');
    expect(res.qualityBand).toBe('usable');
  });

  it('classifies low confidence or coverage as insufficient', () => {
    expect(evaluateMetrologicalQuality(0.60, 0.95).qualityBand).toBe('insufficient');
    expect(evaluateMetrologicalQuality(0.95, 0.65).qualityBand).toBe('insufficient');
  });
});

describe('biomechanical evaluators', () => {
  it('keeps biomechanical readings descriptive instead of normative', () => {
    const evaluations = [
      evaluateCyclingKneeBdc(18),
      evaluateCyclingKneeTracking(30),
      evaluateCyclingPelvicRocking(5.2),
      evaluateRunningCadence(145),
      evaluateRunningPelvicDrop(7.8),
      evaluateRunningKneeValgus(12),
      evaluateRunningStepWidth(0.1, true),
    ];
    expect(evaluations.every((evaluation) => evaluation.source === 'descriptive')).toBe(true);
    expect(evaluations.every((evaluation) => evaluation.title === 'Lectura descriptiva')).toBe(true);
    expect(evaluations.map((evaluation) => evaluation.level)).toEqual([
      'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow',
    ]);
  });
});

describe('evaluateAgainstGhost', () => {
  it('separates regression comparison from biomechanical interpretation', () => {
    expect(evaluateAgainstGhost(31.8, 31.8, 6, 'BDC', '°').level).toBe('green');
    expect(evaluateAgainstGhost(40, 31.8, 6, 'BDC', '°').level).toBe('yellow');
    expect(evaluateAgainstGhost(50, 31.8, 6, 'BDC', '°').level).toBe('red');
    expect(evaluateAgainstGhost(31.8, 31.8, 6, 'BDC', '°').source).toBe('ghost');
  });
});

describe('trafficLightBadgeClasses & trafficLightLabel', () => {
  it('returns distinct accessible classes and labels', () => {
    expect(trafficLightLabel('green')).toBe('Óptimo');
    expect(trafficLightLabel('yellow')).toBe('Atención');
    expect(trafficLightLabel('red')).toBe('Revisión');
    expect(trafficLightBadgeClasses('green')).toContain('emerald');
    expect(trafficLightBadgeClasses('yellow')).toContain('amber');
    expect(trafficLightBadgeClasses('red')).toContain('rose');
  });
});
