import { describe, expect, it } from 'vitest';

import {
  angleAt,
  buildKneeRecommendation,
  median,
  rangeStatus,
  summarizePoseFrames,
  type LandmarkPoint,
} from '../lib/biomechanics';

describe('angleAt', () => {
  it('calculates a right angle', () => {
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });

  it('calculates a straight angle', () => {
    expect(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });
});

describe('statistics and target logic', () => {
  it('uses a stable median for odd and even samples', () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([9, 1, 5, 3])).toBe(4);
  });

  it('classifies the configured knee range', () => {
    const target = { min: 25, max: 35 };
    expect(rangeStatus(24, target)).toBe('below');
    expect(rangeStatus(30, target)).toBe('within');
    expect(rangeStatus(36, target)).toBe('above');
  });

  it('limits recommendations to a single conservative change', () => {
    const target = { min: 25, max: 35 };
    expect(buildKneeRecommendation(39, target).detail).toContain('3 mm');
    expect(buildKneeRecommendation(20, target).detail).toContain('3 mm');
    expect(buildKneeRecommendation(30, target).status).toBe('within');
  });
});

describe('summarizePoseFrames', () => {
  it('converts the included knee angle into knee flexion at extension', () => {
    const frame = (ankleX: number): { time: number; landmarks: LandmarkPoint[] } => {
      const landmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.98 }));
      landmarks[12] = { x: 0.2, y: 0.2, visibility: 0.98 };
      landmarks[24] = { x: 0.4, y: 0.4, visibility: 0.98 };
      landmarks[26] = { x: 0.5, y: 0.6, visibility: 0.98 };
      landmarks[28] = { x: ankleX, y: 0.85, visibility: 0.98 };
      return { time: ankleX, landmarks };
    };

    const result = summarizePoseFrames([frame(0.46), frame(0.5), frame(0.54)], 'right');
    expect(result).not.toBeNull();
    expect(result!.validFrames).toBe(3);
    expect(result!.kneeFlexionBdc).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeGreaterThan(0.9);
  });

  it('rejects an insufficient number of visible frames', () => {
    expect(summarizePoseFrames([], 'right')).toBeNull();
  });
});
