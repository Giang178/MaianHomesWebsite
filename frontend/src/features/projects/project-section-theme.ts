const SECTION_ALIASES: Record<string, string[]> = {
  'gioi-thieu': ['gioi-thieu', 'hero'],
  'tong-quan': ['tong-quan', 'gioi-thieu'],
  'vi-tri': ['vi-tri'],
  'mat-bang': ['mat-bang'],
  'tien-ich': ['tien-ich', 'mat-bang-tien-ich', 'thu-vien-tien-ich', 'tien-ich-ngoai-troi', 'tien-ich-trong-nha'],
  'mat-bang-tien-ich': ['mat-bang-tien-ich', 'tien-ich'],
  'chu-dau-tu': ['chu-dau-tu', 'cau-chuyen'],
  'cau-chuyen': ['cau-chuyen', 'chu-dau-tu'],
  'tai-lieu': ['tai-lieu'],
  'faq': ['faq'],
  'lien-he': ['lien-he'],
};

export function resolveProjectSectionBackground(
  sectionColors: Record<string, string> | undefined,
  sectionId: string,
): string {
  if (!sectionColors) return 'transparent';
  const aliases = SECTION_ALIASES[sectionId] || [sectionId];
  for (const key of aliases) {
    const val = sectionColors[key]?.trim();
    if (val) return val;
  }
  return 'transparent';
}

export function isLightColor(color: string | undefined, defaultLight: boolean = true): boolean {
  if (!color || color === 'transparent') return defaultLight;
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128;
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 128;
    }
  }
  return defaultLight;
}
