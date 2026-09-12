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

  it('calculates 30°', () => {
    expect(angleAt(
      { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    )).toBeCloseTo(30, 0);
  });

  it('calculates 150°', () => {
    expect(angleAt(
      { x: Math.cos((5 * Math.PI) / 6), y: Math.sin((5 * Math.PI) / 6) },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    )).toBeCloseTo(150, 0);
  });

  it('calculates 0° (collinear, same direction)', () => {
    expect(angleAt({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
  });

  it('returns NaN for zero-length vector', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN();
  });
});

describe('statistics and target logic', () => {
  it('uses a stable median for odd and even samples', () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([9, 1, 5, 3])).toBe(4);
  });

  it('returns NaN for empty array', () => {
    expect(median([])).toBeNaN();
  });

  it('classifies the configured knee range', () => {
    const target = { min: 25, max: 35 };
    expect(rangeStatus(24, target)).toBe('below');
    expect(rangeStatus(30, target)).toBe('within');
    expect(rangeStatus(36, target)).toBe('above');
  });

  it('classifies boundary values', () => {
    const target = { min: 25, max: 35 };
    expect(rangeStatus(25, target)).toBe('within');
    expect(rangeStatus(35, target)).toBe('within');
  });

  it('handles inverted target range (min > max)', () => {
    const target = { min: 40, max: 25 };
    // With min > max, nothing can be within: values below min return 'below', above max return 'above'
    expect(rangeStatus(30, target)).toBe('below');
    expect(rangeStatus(20, target)).toBe('below');
    expect(rangeStatus(45, target)).toBe('above');
  });

  it('limits recommendations to a single conservative change', () => {
    const target = { min: 25, max: 35 };
    expect(buildKneeRecommendation(39, target).detail).toContain('3 mm');
    expect(buildKneeRecommendation(20, target).detail).toContain('3 mm');
    expect(buildKneeRecommendation(30, target).status).toBe('within');
  });
});

describe('summarizePoseFrames', () => {
  const makeFrame = (ankleX: number): { time: number; landmarks: LandmarkPoint[] } => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.98 }));
    landmarks[12] = { x: 0.2, y: 0.2, visibility: 0.98 };
    landmarks[24] = { x: 0.4, y: 0.4, visibility: 0.98 };
    landmarks[26] = { x: 0.5, y: 0.6, visibility: 0.98 };
    landmarks[28] = { x: ankleX, y: 0.85, visibility: 0.98 };
    return { time: ankleX, landmarks };
  };

  it('converts the included knee angle into knee flexion at extension', () => {
    const result = summarizePoseFrames([makeFrame(0.46), makeFrame(0.5), makeFrame(0.54)], 'right');
    expect(result).not.toBeNull();
    expect(result!.validFrames).toBe(3);
    expect(result!.kneeFlexionBdc).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('rejects an insufficient number of visible frames', () => {
    expect(summarizePoseFrames([], 'right')).toBeNull();
  });

  it('rejects frames with 2 valid frames (below minimum of 3)', () => {
    expect(summarizePoseFrames([makeFrame(0.46), makeFrame(0.5)], 'right')).toBeNull();
  });

  it('reports detectionConfidence and frameCoverage independently', () => {
    const result = summarizePoseFrames([makeFrame(0.46), makeFrame(0.5), makeFrame(0.54)], 'right');
    expect(result).not.toBeNull();
    expect(result!.detectionConfidence).toBeGreaterThan(0);
    expect(result!.frameCoverage).toBeGreaterThan(0);
    expect(result!.confidence).toBeCloseTo(result!.detectionConfidence * result!.frameCoverage, 0);
  });

  it('discards frames with visibility below threshold', () => {
    const lowVisFrames = Array.from({ length: 5 }, () => {
      const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.3 }));
      return { time: 0, landmarks };
    });
    expect(summarizePoseFrames(lowVisFrames, 'right')).toBeNull();
  });
});
