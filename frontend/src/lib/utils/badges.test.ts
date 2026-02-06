/**
 * Tests for Badge Rendering Utility
 */

import { describe, it, expect } from 'vitest';
import { renderBadges, type UserBadges } from './badges';

describe('renderBadges', () => {
  it('should render verified badge for verified user', () => {
    const user: UserBadges = { verified: true };
    const badges = renderBadges(user);

    expect(badges).toHaveLength(1);
    expect(badges[0]).toEqual({
      icon: 'check-circle',
      color: 'text-blue-400',
      label: 'Verified'
    });
  });

  it('should render private badge for private user', () => {
    const user: UserBadges = { private: true };
    const badges = renderBadges(user);

    expect(badges).toHaveLength(1);
    expect(badges[0]).toEqual({
      icon: 'lock',
      color: 'text-slate-400',
      label: 'Private'
    });
  });

  it('should render both badges when user is verified and private', () => {
    const user: UserBadges = { verified: true, private: true };
    const badges = renderBadges(user);

    expect(badges).toHaveLength(2);
    
    // Verified badge should be first
    expect(badges[0]).toEqual({
      icon: 'check-circle',
      color: 'text-blue-400',
      label: 'Verified'
    });
    
    // Private badge should be second
    expect(badges[1]).toEqual({
      icon: 'lock',
      color: 'text-slate-400',
      label: 'Private'
    });
  });

  // Test: No badges for regular user
  it('should return empty array when user has no badges', () => {
    const user: UserBadges = { verified: false, private: false };
    const badges = renderBadges(user);

    expect(badges).toEqual([]);
  });

  it('should return empty array when user has undefined flags', () => {
    const user: UserBadges = {};
    const badges = renderBadges(user);

    expect(badges).toEqual([]);
  });

  // Test: Handle null/undefined user gracefully
  it('should return empty array for null user', () => {
    const badges = renderBadges(null);
    expect(badges).toEqual([]);
  });

  it('should return empty array for undefined user', () => {
    const badges = renderBadges(undefined);
    expect(badges).toEqual([]);
  });

  // Test: Only verified flag is true
  it('should only render verified badge when private is false', () => {
    const user: UserBadges = { verified: true, private: false };
    const badges = renderBadges(user);

    expect(badges).toHaveLength(1);
    expect(badges[0].icon).toBe('check-circle');
  });

  // Test: Only private flag is true
  it('should only render private badge when verified is false', () => {
    const user: UserBadges = { verified: false, private: true };
    const badges = renderBadges(user);

    expect(badges).toHaveLength(1);
    expect(badges[0].icon).toBe('lock');
  });

  // Test: Badge order consistency
  it('should always render verified badge before private badge', () => {
    const user: UserBadges = { verified: true, private: true };
    const badges = renderBadges(user);

    expect(badges[0].label).toBe('Verified');
    expect(badges[1].label).toBe('Private');
  });

  // Test: Badge properties are correct
  it('should have correct icon for verified badge', () => {
    const user: UserBadges = { verified: true };
    const badges = renderBadges(user);

    expect(badges[0].icon).toBe('check-circle');
  });

  it('should have correct color for verified badge', () => {
    const user: UserBadges = { verified: true };
    const badges = renderBadges(user);

    expect(badges[0].color).toBe('text-blue-400');
  });

  it('should have correct icon for private badge', () => {
    const user: UserBadges = { private: true };
    const badges = renderBadges(user);

    expect(badges[0].icon).toBe('lock');
  });

  it('should have correct color for private badge', () => {
    const user: UserBadges = { private: true };
    const badges = renderBadges(user);

    expect(badges[0].color).toBe('text-slate-400');
  });
});
