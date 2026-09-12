import { describe, expect, it } from 'vitest';

import {
  buildRunningRecommendations,
  classifyFootStrike,
  detectStrideCycles,
  footStrikeAngle,
  makeRunningDemoSummary,
  overstridingIndexCalc,
  summarizeRunningFrames,
  torsoLeanFromVertical,
  type RunningAnalysisSummary,
} from '../lib/running-biomechanics';
import type { LandmarkPoint, PoseFrame } from '../lib/types';

describe('running geometry helpers', () => {
  describe('footStrikeAngle & classifyFootStrike', () => {
    it('calculates positive angle when heel is lower than toe (rearfoot strike)', () => {
      // In image coords: y increases downwards. Heel lower than toe means heel.y > toe.y.
      // toe.y - heel.y < 0, but let's check definition:
      // Math.atan2(toe.y - heel.y, toe.x - heel.x) * (180 / Math.PI)
      const heel: LandmarkPoint = { x: 0.5, y: 0.85, visibility: 0.9 };
      const toe: LandmarkPoint = { x: 0.6, y: 0.88, visibility: 0.9 };
      // dx = 0.1, dy = 0.03 -> atan2(0.03, 0.1) > 0 => angle > 8 => rearfoot
      const angle = footStrikeAngle(heel, toe);
      expect(angle).toBeGreaterThan(8);
      expect(classifyFootStrike(angle)).toBe('rearfoot');
    });

    it('classifies angles between -8 and 8 as midfoot', () => {
      expect(classifyFootStrike(0)).toBe('midfoot');
      expect(classifyFootStrike(7.9)).toBe('midfoot');
      expect(classifyFootStrike(-7.9)).toBe('midfoot');
      expect(classifyFootStrike(8)).toBe('midfoot');
      expect(classifyFootStrike(-8)).toBe('midfoot');
    });

    it('classifies angles below -8 as forefoot', () => {
      expect(classifyFootStrike(-8.1)).toBe('forefoot');
      expect(classifyFootStrike(-15)).toBe('forefoot');
    });

    it('classifies angles above 8 as rearfoot', () => {
      expect(classifyFootStrike(8.1)).toBe('rearfoot');
      expect(classifyFootStrike(18)).toBe('rearfoot');
    });
  });

  describe('torsoLeanFromVertical', () => {
    it('calculates 0° lean when shoulder is vertically aligned with hip', () => {
      const hip: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      const shoulder: LandmarkPoint = { x: 0.5, y: 0.3, visibility: 0.9 };
      expect(torsoLeanFromVertical(shoulder, hip)).toBeCloseTo(0, 1);
    });

    it('calculates forward lean when shoulder is horizontally displaced from hip', () => {
      const hip: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      // dx = 0.05, dy = 0.3 -> atan2(0.05, 0.3) * 180 / pi ≈ 9.46°
      const shoulder: LandmarkPoint = { x: 0.55, y: 0.3, visibility: 0.9 };
      const lean = torsoLeanFromVertical(shoulder, hip);
      expect(lean).toBeGreaterThan(8);
      expect(lean).toBeLessThan(11);
    });

    it('returns 90° for horizontal trunk (dy < 0.0001)', () => {
      const hip: LandmarkPoint = { x: 0.5, y: 0.5, visibility: 0.9 };
      const shoulder: LandmarkPoint = { x: 0.7, y: 0.5, visibility: 0.9 };
      expect(torsoLeanFromVertical(shoulder, hip)).toBe(90);
    });
  });

  describe('overstridingIndexCalc', () => {
    it('returns positive index when ankle is ahead of knee in anterior direction', () => {
      const knee: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      const ankle: LandmarkPoint = { x: 0.55, y: 0.8, visibility: 0.9 };
      const idx = overstridingIndexCalc(ankle, knee);
      expect(idx).toBeGreaterThan(0);
    });

    it('returns negative index when ankle is behind knee', () => {
      const knee: LandmarkPoint = { x: 0.55, y: 0.6, visibility: 0.9 };
      const ankle: LandmarkPoint = { x: 0.5, y: 0.8, visibility: 0.9 };
      const idx = overstridingIndexCalc(ankle, knee);
      expect(idx).toBeLessThan(0);
    });

    it('returns NaN if tibia length is virtually zero', () => {
      const point: LandmarkPoint = { x: 0.5, y: 0.6, visibility: 0.9 };
      expect(Number.isNaN(overstridingIndexCalc(point, point))).toBe(true);
    });
  });
});

describe('detectStrideCycles', () => {
  it('returns empty array when measured frames are fewer than 6', () => {
    expect(detectStrideCycles([])).toEqual([]);
  });

  it('detects cycles from simulated ankle oscillation', () => {
    // 30 fps, 100 frames (~3.33s), stride frequency ~2.5 Hz (0.4s per stride = 12 frames)
    const measured = Array.from({ length: 70 }, (_, i) => {
      const t = i / 30;
      // Ankle y moves up and down: IC is maximum y (lowest foot position)
      const anklY = 0.8 + 0.08 * Math.sin((2 * Math.PI * i) / 15);
      // Knee angle has minimum (max flexion) shortly after IC
      const kneeAngle = 140 + 20 * Math.sin((2 * Math.PI * i) / 15 + 1);
      return {
        frame: {
          time: t,
          landmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 })),
        },
        index: i,
        anklY,
        kneeAngle,
        hipAngle: 160,
        torsoAngle: 7,
        fsAngle: 5,
        overstrideIdx: 0.05,
        confidence: 0.95,
      };
    });

    const cycles = detectStrideCycles(measured);
    expect(cycles.length).toBeGreaterThanOrEqual(3);
    for (const c of cycles) {
      expect(c.icIndex).toBeLessThan(c.toIndex);
      expect(c.icTime).toBeLessThan(c.toTime);
    }
  });
});

describe('summarizeRunningFrames', () => {
  const createRunningFrames = (count: number, visibility = 0.9): PoseFrame[] => {
    return Array.from({ length: count }, (_, i) => {
      const t = i / 30;
      const phase = (2 * Math.PI * i) / 12; // period of 12 frames (0.4s) -> ~150 SPM
      const ankleY = 0.8 + 0.06 * Math.sin(phase);

      const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility,
      }));

      // Right side indices: shoulder 12, hip 24, knee 26, ankle 28, heel 30, footIndex 32
      landmarks[12] = { x: 0.48, y: 0.25, visibility };
      landmarks[24] = { x: 0.46, y: 0.50, visibility };
      landmarks[26] = { x: 0.48, y: 0.65, visibility };
      landmarks[28] = { x: 0.49, y: ankleY, visibility };
      landmarks[30] = { x: 0.47, y: ankleY + 0.02, visibility };
      landmarks[32] = { x: 0.53, y: ankleY + 0.02, visibility };

      return { time: t, landmarks };
    });
  };

  it('summarizes running frames into valid metrics with >= 3 stride cycles', () => {
    const frames = createRunningFrames(80);
    const summary = summarizeRunningFrames(frames, 'right');

    expect(summary).not.toBeNull();
    if (!summary) return;

    expect(summary.modality).toBe('running');
    expect(summary.cadenceSpm).toBeGreaterThan(100);
    expect(summary.strideCyclesDetected).toBeGreaterThanOrEqual(3);
    expect(summary.validFrames).toBe(80);
    expect(summary.confidence).toBeGreaterThan(0.7);
    expect(summary.selectedFrame).toBeDefined();
  });

  it('rejects videos with insufficient frames or stride cycles', () => {
    const frames = createRunningFrames(10);
    expect(summarizeRunningFrames(frames, 'right')).toBeNull();
  });

  it('discards frames with visibility below threshold', () => {
    const frames = createRunningFrames(80, 0.4); // below 0.55
    expect(summarizeRunningFrames(frames, 'right')).toBeNull();
  });
});

describe('buildRunningRecommendations', () => {
  const baseSummary: RunningAnalysisSummary = {
    modality: 'running',
    cadenceSpm: 172,
    footStrikeAngleDeg: 5,
    footStrikeType: 'midfoot',
    overstridingIndex: 0.06,
    kneeFlexionAtContactDeg: 18,
    kneeFlexionAtMidstanceDeg: 38,
    torsoLeanMedianDeg: 7,
    detectionConfidence: 0.95,
    frameCoverage: 0.92,
    confidence: 0.88,
    validFrames: 60,
    totalFrames: 65,
    strideCyclesDetected: 5,
    selectedFrame: { time: 2.0, landmarks: [] },
  };

  it('generates optimal recommendations for ideal biomechanics', () => {
    const recs = buildRunningRecommendations(baseSummary);
    expect(recs.length).toBe(3);
    expect(recs.every(r => r.status === 'optimal')).toBe(true);
  });

  it('alerts on low cadence with overstriding', () => {
    const summary: RunningAnalysisSummary = {
      ...baseSummary,
      cadenceSpm: 152,
      overstridingIndex: 0.22,
    };
    const recs = buildRunningRecommendations(summary);
    const cadRec = recs.find(r => r.title.includes('sobrezancada'));
    expect(cadRec).toBeDefined();
    expect(cadRec?.status).toBe('caution');
  });

  it('flags rearfoot strike with extended knee as caution', () => {
    const summary: RunningAnalysisSummary = {
      ...baseSummary,
      footStrikeType: 'rearfoot',
      footStrikeAngleDeg: 16,
      kneeFlexionAtContactDeg: 8,
    };
    const recs = buildRunningRecommendations(summary);
    const strikeRec = recs.find(r => r.title.includes('rodilla extendida'));
    expect(strikeRec).toBeDefined();
    expect(strikeRec?.status).toBe('caution');
  });

  it('flags excessive forward torso lean as caution', () => {
    const summary: RunningAnalysisSummary = {
      ...baseSummary,
      torsoLeanMedianDeg: 18,
    };
    const recs = buildRunningRecommendations(summary);
    const torsoRec = recs.find(r => r.title.includes('Colapso anterior'));
    expect(torsoRec).toBeDefined();
    expect(torsoRec?.status).toBe('caution');
  });

  it('flags overly upright posture as attention', () => {
    const summary: RunningAnalysisSummary = {
      ...baseSummary,
      torsoLeanMedianDeg: 1.2,
    };
    const recs = buildRunningRecommendations(summary);
    const torsoRec = recs.find(r => r.title.includes('erguida'));
    expect(torsoRec).toBeDefined();
    expect(torsoRec?.status).toBe('attention');
  });
});

describe('makeRunningDemoSummary', () => {
  it('provides a complete valid demo summary', () => {
    const demo = makeRunningDemoSummary();
    expect(demo.modality).toBe('running');
    expect(demo.cadenceSpm).toBe(168);
    expect(demo.footStrikeType).toBe('midfoot');
    expect(demo.selectedFrame.landmarks).toHaveLength(33);
  });
});
