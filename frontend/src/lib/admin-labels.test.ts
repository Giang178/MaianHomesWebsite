import {describe, expect, it} from 'vitest';
import {adminLabel, adminLabelWithCode} from './admin-labels';

describe('admin labels', () => {
  it('translates common roles and statuses', () => {
    expect(adminLabel('ADMIN', 'role')).toBe('Quản trị viên');
    expect(adminLabel('PENDING_APPROVAL', 'status')).toBe('Chờ duyệt');
  });
  it('does not expose unknown codes in the primary label', () => {
    expect(adminLabel('SOME_NEW_CODE', 'event')).toBe('Không xác định');
    expect(adminLabelWithCode('SOME_NEW_CODE', 'event')).toEqual({label: 'Không xác định', code: 'SOME_NEW_CODE'});
  });
});
