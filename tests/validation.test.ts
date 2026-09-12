import { describe, expect, it } from 'vitest';

import {
  isConfidenceSufficient,
  MIN_GLOBAL_CONFIDENCE,
  validateCyclingInputs,
  validateRunningInputs,
} from '../lib/validation';

describe('validation rules', () => {
  describe('isConfidenceSufficient', () => {
    it('requires at least 0.65 global confidence', () => {
      expect(MIN_GLOBAL_CONFIDENCE).toBe(0.65);
      expect(isConfidenceSufficient(0.64)).toBe(false);
      expect(isConfidenceSufficient(0.65)).toBe(true);
      expect(isConfidenceSufficient(0.85)).toBe(true);
      expect(isConfidenceSufficient(0)).toBe(false);
    });
  });

  describe('validateCyclingInputs', () => {
    it('accepts valid default inputs', () => {
      expect(validateCyclingInputs('82', '172.5', { min: 25, max: 35 })).toBeNull();
    });

    it('rejects out-of-range or non-numeric inseam', () => {
      expect(validateCyclingInputs('35', '170', { min: 25, max: 35 })).toEqual({
        field: 'inseam',
        message: 'Entrepierna fuera de rango (40–120 cm).',
      });
      expect(validateCyclingInputs('130', '170', { min: 25, max: 35 })).toEqual({
        field: 'inseam',
        message: 'Entrepierna fuera de rango (40–120 cm).',
      });
      expect(validateCyclingInputs('abc', '170', { min: 25, max: 35 })).toEqual({
        field: 'inseam',
        message: 'Entrepierna fuera de rango (40–120 cm).',
      });
    });

    it('rejects out-of-range or non-numeric crank length', () => {
      expect(validateCyclingInputs('80', '100', { min: 25, max: 35 })).toEqual({
        field: 'crank',
        message: 'Biela fuera de rango (120–220 mm).',
      });
      expect(validateCyclingInputs('80', '250', { min: 25, max: 35 })).toEqual({
        field: 'crank',
        message: 'Biela fuera de rango (120–220 mm).',
      });
    });

    it('rejects inverted or equal target ranges', () => {
      expect(validateCyclingInputs('80', '170', { min: 35, max: 25 })).toEqual({
        field: 'target',
        message: 'El mínimo del objetivo debe ser menor que el máximo.',
      });
      expect(validateCyclingInputs('80', '170', { min: 30, max: 30 })).toEqual({
        field: 'target',
        message: 'El mínimo del objetivo debe ser menor que el máximo.',
      });
    });
  });

  describe('validateRunningInputs', () => {
    it('accepts valid height and optional cadence', () => {
      expect(validateRunningInputs('175', '')).toBeNull();
      expect(validateRunningInputs('180', '170')).toBeNull();
    });

    it('rejects out-of-range or invalid height', () => {
      expect(validateRunningInputs('90', '')).toEqual({
        field: 'height',
        message: 'Estatura fuera de rango (100–220 cm).',
      });
      expect(validateRunningInputs('230', '')).toEqual({
        field: 'height',
        message: 'Estatura fuera de rango (100–220 cm).',
      });
      expect(validateRunningInputs('abc', '')).toEqual({
        field: 'height',
        message: 'Estatura fuera de rango (100–220 cm).',
      });
    });

    it('rejects out-of-range cadence if provided', () => {
      expect(validateRunningInputs('175', '80')).toEqual({
        field: 'cadence',
        message: 'Cadencia fuera de rango (100–240 SPM).',
      });
      expect(validateRunningInputs('175', '260')).toEqual({
        field: 'cadence',
        message: 'Cadencia fuera de rango (100–240 SPM).',
      });
      expect(validateRunningInputs('175', 'xyz')).toEqual({
        field: 'cadence',
        message: 'Cadencia fuera de rango (100–240 SPM).',
      });
    });
  });
});
