import { describe, it, expect } from 'vitest';
import { formatLkPhone, normalizeLkPhone } from './phone.js';
import { formatLKR } from './format.js';
import { DISTRICTS } from './districts.js';

describe('normalizeLkPhone', () => {
  it('accepts local 07X format', () => {
    expect(normalizeLkPhone('0771234567')).toBe('+94771234567');
  });

  it('accepts +94 and bare 94 prefixes', () => {
    expect(normalizeLkPhone('+94771234567')).toBe('+94771234567');
    expect(normalizeLkPhone('94771234567')).toBe('+94771234567');
  });

  it('tolerates spaces and dashes', () => {
    expect(normalizeLkPhone('077 123 4567')).toBe('+94771234567');
    expect(normalizeLkPhone('+94 77-123-4567')).toBe('+94771234567');
  });

  it('rejects landlines, short numbers, and foreign numbers', () => {
    expect(normalizeLkPhone('0112345678')).toBeNull(); // Colombo landline
    expect(normalizeLkPhone('077123456')).toBeNull(); // too short
    expect(normalizeLkPhone('+447712345678')).toBeNull(); // UK
    expect(normalizeLkPhone('')).toBeNull();
  });
});

describe('formatLkPhone', () => {
  it('renders grouped display form', () => {
    expect(formatLkPhone('+94771234567')).toBe('+94 77 123 4567');
  });
});

describe('formatLKR', () => {
  it('formats with Rs. prefix, thousands separators, 2 decimals', () => {
    expect(formatLKR(1500)).toBe('Rs. 1,500.00');
    expect(formatLKR(250)).toBe('Rs. 250.00');
    expect(formatLKR(1234567.5)).toBe('Rs. 1,234,567.50');
  });
});

describe('DISTRICTS', () => {
  it('contains all 25 districts with trilingual names', () => {
    expect(DISTRICTS).toHaveLength(25);
    for (const d of DISTRICTS) {
      expect(d.en.length).toBeGreaterThan(0);
      expect(d.si.length).toBeGreaterThan(0);
      expect(d.ta.length).toBeGreaterThan(0);
    }
  });
});
