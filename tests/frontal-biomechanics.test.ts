import { describe, expect, it } from 'vitest';

import {
  frontalKneeValgusDeg,
  kneePlumblineDeviationMm,
  makeFrontalCyclingDemoSummary,
  makeFrontalRunningDemoSummary,
  pelvicAngleDeg,
  stepWidthNormalized,
  summarizeFrontalCyclingFrames,
  summarizeFrontalRunningFrames,
} from '../lib/frontal-biomechanics';
import { BILATERAL_LANDMARKS } from '../lib/landmarks';
import type { LandmarkPoint, PoseFrame } from '../lib/types';

describe('frontal geometry helpers', () => {
  describe('pelvicAngleDeg', () => {
    it('returns 0° when hips are perfectly horizontal', () => {
      const lh: LandmarkPoint = { x: 0.4, y: 0.5, visibility: 0.9 };
      const rh: LandmarkPoint = { x: 0.6, y: 0.5, visibility: 0.9 };
      expect(pelvicAngleDeg(lh, rh)).toBeCloseTo(0, 2);
    });

    it('calculates tilt when one hip is lower than the other', () => {
      const lh: LandmarkPoint = { x: 0.4, y: 0.52, visibility: 0.9 };
      const rh: LandmarkPoint = { x: 0.6, y: 0.5, visibility: 0.9 };
      // dx = 0.2, dy = 0.02 -> atan2(0.02, 0.2) * 180 / pi ≈ 5.71°
      const angle = pelvicAngleDeg(lh, rh);
      expect(angle).toBeGreaterThan(5);
      expect(angle).toBeLessThan(6.5);
    });

    it('returns 90° for degenerate vertical hips (dx < 0.0001)', () => {
      const lh: LandmarkPoint = { x: 0.5, y: 0.4, visibility: 0.9 };
      const rh: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      expect(pelvicAngleDeg(lh, rh)).toBe(90);
    });
  });

  describe('frontalKneeValgusDeg', () => {
    it('returns 0° when hip, knee, and ankle are collinear (180°)', () => {
      const hip: LandmarkPoint = { x: 0.5, y: 0.3, visibility: 0.9 };
      const knee: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      const ankle: LandmarkPoint = { x: 0.5, y: 0.9, visibility: 0.9 };
      expect(frontalKneeValgusDeg(hip, knee, ankle)).toBeCloseTo(0, 1);
    });

    it('calculates positive valgus angle when knee is medially displaced', () => {
      const hip: LandmarkPoint = { x: 0.45, y: 0.3, visibility: 0.9 };
      const knee: LandmarkPoint = { x: 0.50, y: 0.6, visibility: 0.9 };
      const ankle: LandmarkPoint = { x: 0.45, y: 0.9, visibility: 0.9 };
      const valgus = frontalKneeValgusDeg(hip, knee, ankle);
      expect(valgus).toBeGreaterThan(5);
    });
  });

  describe('stepWidthNormalized', () => {
    it('calculates ratio and flags no crossover when feet are separated', () => {
      const lh: LandmarkPoint = { x: 0.4, y: 0.5, visibility: 0.9 };
      const rh: LandmarkPoint = { x: 0.6, y: 0.5, visibility: 0.9 };
      const la: LandmarkPoint = { x: 0.38, y: 0.9, visibility: 0.9 };
      const ra: LandmarkPoint = { x: 0.62, y: 0.9, visibility: 0.9 };
      const res = stepWidthNormalized(la, ra, lh, rh);
      expect(res.ratio).toBeGreaterThan(0.5);
      expect(res.crossover).toBe(false);
    });

    it('detects crossover when feet invert order relative to hips', () => {
      const lh: LandmarkPoint = { x: 0.4, y: 0.5, visibility: 0.9 };
      const rh: LandmarkPoint = { x: 0.6, y: 0.5, visibility: 0.9 };
      // Left ankle is on the right side of right ankle
      const la: LandmarkPoint = { x: 0.56, y: 0.9, visibility: 0.9 };
      const ra: LandmarkPoint = { x: 0.44, y: 0.9, visibility: 0.9 };
      const res = stepWidthNormalized(la, ra, lh, rh);
      expect(res.crossover).toBe(true);
    });
  });

  describe('kneePlumblineDeviationMm', () => {
    it('returns 0 when knee lies exactly on hip-ankle plumb line', () => {
      const hip: LandmarkPoint = { x: 0.5, y: 0.3, visibility: 0.9 };
      const knee: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      const ankle: LandmarkPoint = { x: 0.5, y: 0.9, visibility: 0.9 };
      expect(kneePlumblineDeviationMm(hip, knee, ankle, 0.2)).toBe(0);
    });

    it('scales lateral deviation to millimeters based on pelvic width', () => {
      const hip: LandmarkPoint = { x: 0.4, y: 0.3, visibility: 0.9 };
      const knee: LandmarkPoint = { x: 0.42, y: 0.6, visibility: 0.9 }; // dx = 0.02
      const ankle: LandmarkPoint = { x: 0.4, y: 0.9, visibility: 0.9 };
      // pelvicWidth = 0.2 in coords, assumed 260 mm -> mmPerPixel = 1300 mm/unit
      // 0.02 * 1300 = 26 mm
      const dev = kneePlumblineDeviationMm(hip, knee, ankle, 0.2);
      expect(dev).toBeCloseTo(26, 0);
    });
  });
});

describe('frontal summarizers', () => {
  const createBilateralFrames = (count: number, visibility = 0.9): PoseFrame[] => {
    return Array.from({ length: count }, (_, i) => {
      const t = i / 30;
      const phase = (2 * Math.PI * i) / 15;
      const pelvicTilt = 0.01 * Math.sin(phase);

      const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility,
      }));

      // Hips
      landmarks[BILATERAL_LANDMARKS.leftHip] = { x: 0.42, y: 0.50 + pelvicTilt, visibility };
      landmarks[BILATERAL_LANDMARKS.rightHip] = { x: 0.58, y: 0.50 - pelvicTilt, visibility };
      // Knees
      landmarks[BILATERAL_LANDMARKS.leftKnee] = { x: 0.42 + 0.01 * Math.sin(phase), y: 0.68, visibility };
      landmarks[BILATERAL_LANDMARKS.rightKnee] = { x: 0.58 - 0.01 * Math.sin(phase), y: 0.68, visibility };
      // Ankles
      landmarks[BILATERAL_LANDMARKS.leftAnkle] = { x: 0.42, y: 0.88, visibility };
      landmarks[BILATERAL_LANDMARKS.rightAnkle] = { x: 0.58, y: 0.88, visibility };

      return { time: t, landmarks };
    });
  };

  it('summarizes frontal cycling frames with tracking and pelvic rocking', () => {
    const frames = createBilateralFrames(30);
    const summary = summarizeFrontalCyclingFrames(frames);

    expect(summary).not.toBeNull();
    if (!summary) return;

    expect(summary.modality).toBe('cycling');
    expect(summary.view).toBe('frontal');
    expect(summary.pelvicRockingDeg).toBeGreaterThan(0);
    expect(summary.kneeLateralExcursionLeftMm).toBeDefined();
    expect(summary.kneeLateralExcursionRightMm).toBeDefined();
    expect(summary.validFrames).toBe(30);
  });

  it('summarizes frontal running frames with pelvic drop and valgus', () => {
    const frames = createBilateralFrames(30);
    const summary = summarizeFrontalRunningFrames(frames);

    expect(summary).not.toBeNull();
    if (!summary) return;

    expect(summary.modality).toBe('running');
    expect(summary.view).toBe('frontal');
    expect(summary.contralateralPelvicDropDeg).toBeGreaterThan(0);
    expect(summary.dynamicKneeValgusLeftDeg).toBeDefined();
    expect(summary.stepWidthRatio).toBeGreaterThan(0);
    expect(summary.validFrames).toBe(30);
  });

  it('rejects videos with insufficient bilateral frames', () => {
    const frames = createBilateralFrames(2);
    expect(summarizeFrontalCyclingFrames(frames)).toBeNull();
    expect(summarizeFrontalRunningFrames(frames)).toBeNull();
  });
});

describe('frontal demo summaries', () => {
  it('generates valid cycling frontal demo summary', () => {
    const demo = makeFrontalCyclingDemoSummary();
    expect(demo.modality).toBe('cycling');
    expect(demo.view).toBe('frontal');
    expect(demo.pelvicRockingDeg).toBe(5.7);
    expect(demo.kneeLateralExcursionLeftMm).toBe(10.7);
  });

  it('generates valid running frontal demo summary', () => {
    const demo = makeFrontalRunningDemoSummary();
    expect(demo.modality).toBe('running');
    expect(demo.view).toBe('frontal');
    expect(demo.contralateralPelvicDropDeg).toBe(7.3);
    expect(demo.dynamicKneeValgusLeftDeg).toBe(3.4);
  });
});
