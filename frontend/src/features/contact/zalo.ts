export const DEFAULT_ZALO_OA_ID = '4085613041166590560';

export const zaloOAUrl = (oaId: string) => `https://zalo.me/${oaId}`;

export const isPersonalPhoneNumber = (val: string): boolean =>
  /^(?:\+?84|0)\d{8,11}$/.test(val.replace(/\s+/g, ''));

export const isValidZaloOAId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^\d{10,30}$/.test(value.trim()) && !isPersonalPhoneNumber(value.trim());

export const resolveZaloOAUrl = (oaId?: string | null, customUrl?: string | null): string => {
  if (customUrl && typeof customUrl === 'string') {
    const cleanUrl = customUrl.trim();
    if (cleanUrl.startsWith('https://zalo.me/') && !/zalo\.me\/(?:\+?84|0)\d{8,11}$/.test(cleanUrl)) {
      return cleanUrl;
    }
  }
  if (oaId && typeof oaId === 'string') {
    const cleanId = oaId.trim();
    if (isValidZaloOAId(cleanId)) {
      return zaloOAUrl(cleanId);
    }
  }
  return zaloOAUrl(DEFAULT_ZALO_OA_ID);
};
