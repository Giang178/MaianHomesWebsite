import { describe, expect, it } from 'vitest';
import { hasPermission } from './use-permissions';

describe('permission checks', () => {
  it('grants only explicit permissions', () => {
    expect(hasPermission(['website.articles.read'], 'website.articles.read')).toBe(true);
    expect(hasPermission(['website.articles.read'], 'website.articles.update')).toBe(false);
  });

  it('supports the CEO wildcard without making roles authoritative', () => {
    expect(hasPermission(['*'], 'website.system.monitoring.run')).toBe(true);
    expect(hasPermission([], 'website.dashboard.read')).toBe(false);
  });
});