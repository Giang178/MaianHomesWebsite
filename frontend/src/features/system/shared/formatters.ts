export const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('vi-VN', {dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date(value))
  : 'â€”';

const errorCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};

const errorMessages: Record<string, string> = {
  VERSION_CONFLICT: 'Dá»¯ liá»‡u Ä‘Ã£ Ä‘Æ°á»£c ngÆ°á»i khÃ¡c cáº­p nháº­t. Há»‡ thá»‘ng Ä‘Ã£ táº£i láº¡i phiÃªn báº£n má»›i nháº¥t.',
  RATE_LIMITED: 'Báº¡n Ä‘ang thao tÃ¡c quÃ¡ nhanh. Vui lÃ²ng thá»­ láº¡i sau.',
  SERVICE_UNAVAILABLE: 'Dá»‹ch vá»¥ Ä‘ang táº¡m giÃ¡n Ä‘oáº¡n. Vui lÃ²ng thá»­ láº¡i sau.',
  REQUEST_TIMEOUT: 'MÃ¡y chá»§ pháº£n há»“i quÃ¡ cháº­m. Vui lÃ²ng thá»­ láº¡i.',
  NETWORK_ERROR: 'KhÃ´ng thá»ƒ káº¿t ná»‘i mÃ¡y chá»§. Vui lÃ²ng kiá»ƒm tra káº¿t ná»‘i máº¡ng.',
  ACCOUNT_NOT_FOUND: 'KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n ngÆ°á»i dÃ¹ng.',
  SELF_ACCOUNT_MODIFICATION_FORBIDDEN: 'Báº¡n khÃ´ng thá»ƒ tá»± chá»‰nh sá»­a tÃ i khoáº£n cá»§a chÃ­nh mÃ¬nh.',
  PROTECTED_ACCOUNT: 'TÃ i khoáº£n quáº£n trá»‹ cáº¥p cao Ä‘Æ°á»£c báº£o vá»‡, khÃ´ng thá»ƒ chá»‰nh sá»­a.',
  SELF_SESSION_REVOCATION_FORBIDDEN: 'Báº¡n khÃ´ng thá»ƒ tá»± thu há»“i phiÃªn lÃ m viá»‡c cá»§a chÃ­nh mÃ¬nh.',
  CEO_SESSION_REVOCATION_FORBIDDEN: 'KhÃ´ng thá»ƒ thu há»“i phiÃªn lÃ m viá»‡c cá»§a tÃ i khoáº£n CEO.',
  EMAIL_ACCESS_URL_REQUIRED: 'Vui lÃ²ng nháº­p Ä‘á»‹a chá»‰ link truy cáº­p cho máº«u email nÃ y.',
  INVALID_EMAIL_ACCESS_URL: 'Äá»‹a chá»‰ link truy cáº­p pháº£i lÃ  URL HTTP hoáº·c HTTPS há»£p lá»‡.',
  RESET_URL_PLACEHOLDER_REQUIRED: 'Máº«u Ä‘áº·t láº¡i máº­t kháº©u pháº£i chá»©a placeholder {{reset_url}}.',
};

export const errorMessage = (error: unknown) => {
  const code = errorCode(error);
  if (code && errorMessages[code]) return errorMessages[code];
  return error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u.';
};