import { describe, expect, it } from 'vitest';
import { checkPriceMatch, parsePriceToBillion } from './ProjectsSection';

describe('project price filters', () => {
  it('parses a total price range expressed in billions', () => {
    expect(parsePriceToBillion('7 - 12 tỷ')).toEqual({ min: 7, max: 12 });
  });

  it('does not treat a price per square metre as a total project price', () => {
    expect(parsePriceToBillion('85 triệu/m²')).toBeNull();
    expect(checkPriceMatch('85 triệu/m²', '7 - 10 tỷ')).toBe(false);
  });

  it('matches overlapping total price ranges', () => {
    expect(checkPriceMatch('7 - 12 tỷ', '10 - 20 tỷ')).toBe(true);
    expect(checkPriceMatch('1 - 3 tỷ', '7 - 10 tỷ')).toBe(false);
  });

  it('keeps agreement prices in their own filter', () => {
    expect(checkPriceMatch('Liên hệ để nhận giá', 'Thỏa thuận')).toBe(true);
  });
});

