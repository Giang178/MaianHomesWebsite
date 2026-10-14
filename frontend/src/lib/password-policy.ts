export type PasswordPolicy = {
  password_min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_digit: boolean;
  require_special: boolean;
};

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  password_min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_digit: true,
  require_special: true,
};

export const passwordPolicyDescription = (policy: PasswordPolicy) => {
  const requirements = [`ít nhất ${policy.password_min_length} ký tự`];
  if (policy.require_uppercase) requirements.push('chữ hoa');
  if (policy.require_lowercase) requirements.push('chữ thường');
  if (policy.require_digit) requirements.push('chữ số');
  if (policy.require_special) requirements.push('ký tự đặc biệt');
  return requirements.join(', ');
};

export const passwordPolicyError = (password: string, policy: PasswordPolicy) => {
  const invalid = password.length < policy.password_min_length
    || (policy.require_uppercase && !/[A-Z]/.test(password))
    || (policy.require_lowercase && !/[a-z]/.test(password))
    || (policy.require_digit && !/\d/.test(password))
    || (policy.require_special && !/[^A-Za-z0-9]/.test(password));
  return invalid ? `Mật khẩu phải có ${passwordPolicyDescription(policy)}.` : null;
};

export const passwordPolicyChecks = (password: string, policy: PasswordPolicy) => [
  {label: `Ít nhất ${policy.password_min_length} ký tự`, valid: password.length >= policy.password_min_length},
  {label: 'Có chữ hoa', valid: !policy.require_uppercase || /[A-Z]/.test(password)},
  {label: 'Có chữ thường', valid: !policy.require_lowercase || /[a-z]/.test(password)},
  {label: 'Có chữ số', valid: !policy.require_digit || /\d/.test(password)},
  {label: 'Có ký tự đặc biệt', valid: !policy.require_special || /[^A-Za-z0-9]/.test(password)},
];
