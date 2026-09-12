import { describe, expect, it } from 'vitest';

import {
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
  it('classifies high confidence and coverage as green (optimal)', () => {
    const res = evaluateMetrologicalQuality(0.85, 0.92);
    expect(res.level).toBe('green');
    expect(res.marginOfErrorDeg).toBe(1.5);
    expect(res.title).toContain('óptima');
  });

  it('classifies intermediate values as yellow (acceptable)', () => {
    const res = evaluateMetrologicalQuality(0.72, 0.78);
    expect(res.level).toBe('yellow');
    expect(res.marginOfErrorDeg).toBe(4.0);
    expect(res.title).toContain('aceptable');
  });

  it('classifies confidence < 0.65 as red (insufficient)', () => {
    const res = evaluateMetrologicalQuality(0.60, 0.95);
    expect(res.level).toBe('red');
    expect(res.marginOfErrorDeg).toBe(8.0);
    expect(res.title).toContain('insuficiente');
  });

  it('classifies coverage < 0.70 as red (insufficient)', () => {
    const res = evaluateMetrologicalQuality(0.95, 0.65);
    expect(res.level).toBe('red');
  });
});

describe('evaluateCyclingKneeBdc', () => {
  it('classifies within 25°–35° as green', () => {
    expect(evaluateCyclingKneeBdc(30).level).toBe('green');
    expect(evaluateCyclingKneeBdc(25).level).toBe('green');
    expect(evaluateCyclingKneeBdc(35).level).toBe('green');
  });

  it('classifies 20°–24.9° and 35.1°–40° as yellow', () => {
    expect(evaluateCyclingKneeBdc(22).level).toBe('yellow');
    expect(evaluateCyclingKneeBdc(38).level).toBe('yellow');
  });

  it('classifies < 20° or > 40° as red', () => {
    expect(evaluateCyclingKneeBdc(18).level).toBe('red');
    expect(evaluateCyclingKneeBdc(42).level).toBe('red');
  });
});

describe('evaluateCyclingKneeTracking & PelvicRocking', () => {
  it('evaluates knee tracking excursion in mm', () => {
    expect(evaluateCyclingKneeTracking(10).level).toBe('green');
    expect(evaluateCyclingKneeTracking(20).level).toBe('yellow');
    expect(evaluateCyclingKneeTracking(30).level).toBe('red');
  });

  it('evaluates pelvic rocking in degrees', () => {
    expect(evaluateCyclingPelvicRocking(1.8).level).toBe('green');
    expect(evaluateCyclingPelvicRocking(3.5).level).toBe('yellow');
    expect(evaluateCyclingPelvicRocking(5.2).level).toBe('red');
  });
});

describe('running traffic light evaluators', () => {
  it('evaluates cadence functionally', () => {
    expect(evaluateRunningCadence(175).level).toBe('green');
    expect(evaluateRunningCadence(160).level).toBe('yellow');
    expect(evaluateRunningCadence(198).level).toBe('yellow');
    expect(evaluateRunningCadence(145).level).toBe('red');
    expect(evaluateRunningCadence(210).level).toBe('red');
  });

  it('evaluates contralateral pelvic drop (Trendelenburg dinámico)', () => {
    expect(evaluateRunningPelvicDrop(3.2).level).toBe('green');
    expect(evaluateRunningPelvicDrop(5.4).level).toBe('yellow');
    expect(evaluateRunningPelvicDrop(7.8).level).toBe('red');
  });

  it('evaluates dynamic knee valgus (FPPA)', () => {
    expect(evaluateRunningKneeValgus(3.5).level).toBe('green');
    expect(evaluateRunningKneeValgus(7.2).level).toBe('yellow');
    expect(evaluateRunningKneeValgus(12.0).level).toBe('red');
  });

  it('evaluates step width and crossover gait', () => {
    expect(evaluateRunningStepWidth(0.20, false).level).toBe('green');
    expect(evaluateRunningStepWidth(0.10, false).level).toBe('yellow');
    expect(evaluateRunningStepWidth(0.18, true).level).toBe('red');
  });
});

describe('trafficLightBadgeClasses & trafficLightLabel', () => {
  it('returns distinct WCAG-compliant classes and labels for all levels', () => {
    expect(trafficLightLabel('green')).toBe('Óptimo');
    expect(trafficLightLabel('yellow')).toBe('Atención');
    expect(trafficLightLabel('red')).toBe('Revisión');

    expect(trafficLightBadgeClasses('green')).toContain('emerald');
    expect(trafficLightBadgeClasses('yellow')).toContain('amber');
    expect(trafficLightBadgeClasses('red')).toContain('rose');
  });
});
