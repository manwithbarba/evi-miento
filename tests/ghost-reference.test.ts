import { describe, expect, it } from 'vitest';

import { makeDemoSummary } from '../lib/biomechanics';
import { makeFrontalCyclingDemoSummary, makeFrontalRunningDemoSummary } from '../lib/frontal-biomechanics';
import { compareCyclingToGhost, compareRunningToGhost, GHOST_REFERENCES } from '../lib/ghost-reference';
import { makeRunningDemoSummary } from '../lib/running-biomechanics';

describe('calibration ghosts', () => {
  it('keeps one immutable ghost per biplanar modality', () => {
    expect(GHOST_REFERENCES.cycling.immutable).toBe(true);
    expect(GHOST_REFERENCES.running.immutable).toBe(true);
    expect(GHOST_REFERENCES.cycling.id).toContain('bike');
    expect(GHOST_REFERENCES.running.id).toContain('running');
  });

  it('aligns the demo cases with their QA ghosts', () => {
    const cycling = compareCyclingToGhost(makeDemoSummary(), makeFrontalCyclingDemoSummary());
    const running = compareRunningToGhost(makeRunningDemoSummary(), makeFrontalRunningDemoSummary());
    expect(cycling.filter((item) => item.status === 'aligned')).toHaveLength(6);
    expect(running.filter((item) => item.status === 'aligned')).toHaveLength(9);
  });

  it('detects a regression without turning it into a clinical alert', () => {
    const result = compareRunningToGhost(
      { ...makeRunningDemoSummary(), cadenceSpm: 220 },
    );
    const cadence = result.find((item) => item.key === 'cadenceSpm');
    expect(cadence?.status).toBe('outside-tolerance');
    expect(cadence?.expected).toBe(171.4);
  });
});
