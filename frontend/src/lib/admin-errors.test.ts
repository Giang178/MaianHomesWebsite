import {describe, expect, it} from 'vitest';
import {toVietnameseAdminError} from './admin-errors';

describe('admin error mapper', () => {
  it('maps status and preserves support metadata', () => {
    expect(toVietnameseAdminError({status: 409, request_id: 'req-1'}, 'save')).toMatchObject({message: expect.stringContaining('thay đổi'), requestId: 'req-1', status: 409});
  });
  it('uses a safe Vietnamese fallback for unknown errors', () => {
    expect(toVietnameseAdminError({message: 'SQL trace', code: 'UNKNOWN'}, 'load').message).toBe('Không thể tải dữ liệu. Vui lòng thử lại.');
  });
});
