import { describe, it, expect } from 'vitest';
import { QueueStateService } from './queue-state.service';

describe('QueueStateService.computeAvgMinutes', () => {
  it('falls back to the schedule estimate when no consults recorded yet', () => {
    expect(QueueStateService.computeAvgMinutes(0, 0, 12)).toBe(12);
  });

  it('uses the rolling average of real consult durations', () => {
    // 3 consults of 6 minutes each = 1080 secs.
    expect(QueueStateService.computeAvgMinutes(1080, 3, 12)).toBe(6);
  });

  it('rounds to one decimal place', () => {
    // 400s + 500s = 900s over 2 consults = 7.5 min.
    expect(QueueStateService.computeAvgMinutes(900, 2, 12)).toBe(7.5);
  });

  it('never returns below 1 minute for very fast consults', () => {
    expect(QueueStateService.computeAvgMinutes(30, 3, 12)).toBe(1);
  });
});

describe('QueueStateService.computeEta', () => {
  it('is zero when you are next', () => {
    expect(QueueStateService.computeEta(0, 8)).toBe(0);
  });

  it('multiplies position by average consult minutes', () => {
    // "you are #18, now serving #12" → 5 waiting ahead (13..17 minus served
    // gaps) is handled by the sorted set; ETA is position × avg.
    expect(QueueStateService.computeEta(6, 7)).toBe(42);
  });

  it('rounds to whole minutes', () => {
    expect(QueueStateService.computeEta(3, 7.5)).toBe(23);
  });
});
