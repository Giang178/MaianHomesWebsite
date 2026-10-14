import { describe, expect, it } from 'vitest';
import { resolveProjectSectionBackground } from './project-section-theme';

describe('resolveProjectSectionBackground', () => {
  it('leaves an unconfigured section transparent', () => {
    expect(resolveProjectSectionBackground({}, 'tong-quan')).toBe('transparent');
  });

  it('uses the color explicitly selected for the section', () => {
    expect(resolveProjectSectionBackground({ 'tong-quan': '#123456' }, 'tong-quan')).toBe('#123456');
  });

  it('resolves tien-ich with mat-bang-tien-ich fallback and vice versa', () => {
    expect(resolveProjectSectionBackground({ 'mat-bang-tien-ich': '#153961' }, 'tien-ich')).toBe('#153961');
    expect(resolveProjectSectionBackground({ 'tien-ich': '#654321' }, 'mat-bang-tien-ich')).toBe('#654321');
  });
});
