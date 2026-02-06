/**
 * Tests for Profile Diff Utility
 */

import { describe, it, expect } from 'vitest';
import { detectProfileChanges, type ProfileUser } from './profileDiff';

describe('detectProfileChanges', () => {
  it('should return empty array when before data is undefined', () => {
    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(undefined, after);
    expect(changes).toEqual([]);
  });

  it('should return empty array when before.profile is undefined', () => {
    const before: ProfileUser = {};
    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg'
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toEqual([]);
  });

  it('should return empty array when after data is undefined', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg'
      }
    };

    const changes = detectProfileChanges(before, undefined);
    expect(changes).toEqual([]);
  });

  it('should detect avatar changes', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/old-avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/new-avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'avatar',
      label: 'Avatar updated',
      oldValue: 'https://example.com/old-avatar.jpg',
      newValue: 'https://example.com/new-avatar.jpg'
    });
  });

  it('should detect bio changes', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'Old bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'New bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'bio',
      label: 'Bio changed',
      oldValue: 'Old bio text',
      newValue: 'New bio text'
    });
  });

  it('should detect name changes', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'Bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'Jane Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'name',
      label: 'Name changed',
      oldValue: 'John Doe',
      newValue: 'Jane Doe'
    });
  });

  it('should detect banner changes', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/old-banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/new-banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'banner',
      label: 'Banner updated',
      oldValue: 'https://example.com/old-banner.jpg',
      newValue: 'https://example.com/new-banner.jpg'
    });
  });

  it('should detect multiple field changes', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/old-avatar.jpg',
        banner: 'https://example.com/old-banner.jpg',
        description: { text: 'Old bio' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'Jane Doe',
        avatar: 'https://example.com/new-avatar.jpg',
        banner: 'https://example.com/new-banner.jpg',
        description: { text: 'New bio' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(4);
    
    // Check all changes are detected
    const fields = changes.map(c => c.field);
    expect(fields).toContain('avatar');
    expect(fields).toContain('bio');
    expect(fields).toContain('name');
    expect(fields).toContain('banner');
  });

  // Test: No changes detected when profiles are identical
  it('should return empty array when no changes detected', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        banner: 'https://example.com/banner.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toEqual([]);
  });

  // Test: Handle missing optional fields
  it('should handle missing avatar field', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        description: { text: 'Bio text' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'Bio text' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('avatar');
    expect(changes[0].oldValue).toBeUndefined();
    expect(changes[0].newValue).toBe('https://example.com/avatar.jpg');
  });

  it('should handle missing description field', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg'
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'New bio' }
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('bio');
    expect(changes[0].oldValue).toBeUndefined();
    expect(changes[0].newValue).toBe('New bio');
  });

  it('should handle bio removal', () => {
    const before: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: { text: 'Old bio' }
      }
    };

    const after: ProfileUser = {
      profile: {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        description: {}
      }
    };

    const changes = detectProfileChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('bio');
    expect(changes[0].oldValue).toBe('Old bio');
    expect(changes[0].newValue).toBeUndefined();
  });
});
