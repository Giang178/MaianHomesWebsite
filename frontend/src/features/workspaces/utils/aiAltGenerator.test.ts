import { describe, it, expect } from 'vitest';
import { generateSingleAltText, generateBatchAltTexts } from './aiAltGenerator';

describe('aiAltGenerator', () => {
  it('generates a primary alt text for the first image', () => {
    const alt = generateSingleAltText({
      entityName: 'Bitexco Financial Tower',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      imageIndex: 0,
      isPrimary: true,
    });

    expect(alt).toContain('Bitexco Financial Tower');
    expect(alt).toContain('Quận 1');
    expect(alt).toContain('Mặt tiền');
  });

  it('guarantees 100% unique alt texts when generating in batch to avoid duplicate alt text SEO penalties', () => {
    const count = 15;
    const alts = generateBatchAltTexts(count, {
      entityName: 'Saigon Centre',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      category: 'building',
    });

    expect(alts.length).toBe(count);
    // Check that every single generated alt text is unique
    const uniqueSet = new Set(alts.map((s) => s.toLowerCase()));
    expect(uniqueSet.size).toBe(count);

    alts.forEach((alt) => {
      expect(alt).toContain('Saigon Centre');
      expect(alt.length).toBeGreaterThan(20);
    });
  });

  it('does not duplicate existing alt texts', () => {
    const existing = [
      'Mặt tiền kiến trúc chính thức của tòa nhà Deutsches Haus tại Quận 1, TP. Hồ Chí Minh',
    ];

    const newAlt = generateSingleAltText({
      entityName: 'Deutsches Haus',
      district: 'Quận 1',
      city: 'TP. Hồ Chí Minh',
      imageIndex: 0,
      isPrimary: true,
      existingAlts: existing,
    });

    expect(newAlt).not.toBe(existing[0]);
    expect(existing).not.toContain(newAlt);
  });
});
