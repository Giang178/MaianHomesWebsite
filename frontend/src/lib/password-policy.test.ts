import {describe, expect, it} from 'vitest';

import {passwordPolicyDescription, passwordPolicyError} from './password-policy';

describe('password policy', () => {
  it('applies the current configurable rules instead of fixed frontend rules', () => {
    const relaxed = {
      password_min_length: 14,
      require_uppercase: false,
      require_lowercase: true,
      require_digit: true,
      require_special: false,
    };

    expect(passwordPolicyError('lowercase123456', relaxed)).toBeNull();
    expect(passwordPolicyError('short123', relaxed)).toContain('ít nhất 14 ký tự');
    expect(passwordPolicyDescription(relaxed)).not.toContain('ký tự đặc biệt');
  });
});
