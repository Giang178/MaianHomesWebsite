import { describe, expect, it } from 'vitest';

import { withoutAccessToken } from './AuthContext';

describe('AuthContext compatibility token', () => {
  it('removes a legacy access token before profile persistence', () => {
    const stored = withoutAccessToken({
      email: 'it@example.com',
      role: 'ADMIN',
      access_token: 'legacy-access-token',
    });

    expect(stored.email).toBe('it@example.com');
    expect(stored).not.toHaveProperty('access_token');
  });
});
