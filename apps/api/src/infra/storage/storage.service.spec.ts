import { describe, it, expect } from 'vitest';
import { detectImageType } from './storage.service';

describe('detectImageType (magic bytes)', () => {
  it('detects JPEG', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
    expect(detectImageType(buf)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  it('detects PNG', () => {
    const buf = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    expect(detectImageType(buf)).toEqual({ mime: 'image/png', ext: 'png' });
  });

  it('detects WebP', () => {
    const buf = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.alloc(16),
    ]);
    expect(detectImageType(buf)).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  it('rejects a file whose extension lies (e.g. HTML posing as image)', () => {
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('rejects empty and tiny buffers', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff]))).toBeNull();
  });
});
