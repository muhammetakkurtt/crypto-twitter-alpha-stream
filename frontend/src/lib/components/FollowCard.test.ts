import { describe, it, expect, beforeEach } from 'vitest';
import type { TwitterEvent, FollowingData } from '$lib/types';
import { renderBadges } from '$lib/utils/badges';

describe('FollowCard Component Logic', () => {
  let mockFollowEvent: TwitterEvent;
  let mockUnfollowEvent: TwitterEvent;

  beforeEach(() => {
    mockFollowEvent = {
      type: 'follow_created',
      timestamp: '2024-01-01T12:00:00Z',
      primaryId: 'follow-123',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-123'
      },
      data: {
        username: 'elonmusk',
        action: 'created',
        user: {
          id: 'user-123',
          handle: 'elonmusk',
          private: false,
          verified: true,
          jointed_at: 1243814400000,
          profile: {
            name: 'Elon Musk',
            location: 'San Francisco, CA',
            avatar: 'https://example.com/elon-avatar.jpg',
            banner: 'https://example.com/elon-banner.jpg',
            description: {
              text: 'CEO of Tesla and SpaceX',
              urls: []
            }
          },
          metrics: {
            following: 100,
            followers: 1000000,
            tweets: 5000
          }
        },
        following: {
          id: 'user-456',
          handle: 'BillGates',
          private: false,
          verified: true,
          jointed_at: 1235865600000,
          profile: {
            name: 'Bill Gates',
            location: 'Seattle, WA',
            avatar: 'https://example.com/bill-avatar.jpg',
            banner: 'https://example.com/bill-banner.jpg',
            description: {
              text: 'Co-founder of Microsoft',
              urls: []
            }
          },
          metrics: {
            following: 200,
            followers: 5000000,
            tweets: 3000
          }
        }
      } as FollowingData
    };

    mockUnfollowEvent = {
      type: 'follow_updated',
      timestamp: '2024-01-02T14:30:00Z',
      primaryId: 'follow-456',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-123'
      },
      data: {
        username: 'elonmusk',
        action: 'deleted',
        user: {
          id: 'user-123',
          handle: 'elonmusk',
          profile: {
            name: 'Elon Musk',
            avatar: 'https://example.com/elon-avatar.jpg'
          },
          metrics: {
            following: 99,
            followers: 1000000
          }
        },
        following: {
          id: 'user-789',
          handle: 'JeffBezos',
          profile: {
            name: 'Jeff Bezos',
            avatar: 'https://example.com/jeff-avatar.jpg'
          },
          metrics: {
            following: 150,
            followers: 3000000
          }
        }
      } as FollowingData
    };
  });

  describe('Follow Data Extraction', () => {
    it('should extract follower data from event', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user).toBeDefined();
      expect(data.user?.handle).toBe('elonmusk');
    });

    it('should extract followee data from event', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.following).toBeDefined();
      expect(data.following?.handle).toBe('BillGates');
    });

    it('should extract follower profile information', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user?.profile?.name).toBe('Elon Musk');
      expect(data.user?.profile?.location).toBe('San Francisco, CA');
    });

    it('should extract followee profile information', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.following?.profile?.name).toBe('Bill Gates');
      expect(data.following?.profile?.location).toBe('Seattle, WA');
    });

    it('should extract follower metrics', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user?.metrics?.followers).toBe(1000000);
      expect(data.user?.metrics?.following).toBe(100);
    });

    it('should extract followee metrics', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.following?.metrics?.followers).toBe(5000000);
      expect(data.following?.metrics?.following).toBe(200);
    });
  });

  describe('URL Generation', () => {
    it('should generate correct follower URL', () => {
      const data = mockFollowEvent.data as FollowingData;
      const followerUrl = `https://twitter.com/${data.user?.handle}`;
      expect(followerUrl).toBe('https://twitter.com/elonmusk');
    });

    it('should generate correct followee URL', () => {
      const data = mockFollowEvent.data as FollowingData;
      const followeeUrl = `https://twitter.com/${data.following?.handle}`;
      expect(followeeUrl).toBe('https://twitter.com/BillGates');
    });

    it('should handle missing follower', () => {
      const eventWithoutFollower: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          username: 'test',
          action: 'created',
          following: (mockFollowEvent.data as FollowingData).following
        } as FollowingData
      };
      
      const data = eventWithoutFollower.data as FollowingData;
      const followerUrl = data.user ? `https://twitter.com/${data.user.handle}` : '#';
      expect(followerUrl).toBe('#');
    });

    it('should handle missing followee', () => {
      const eventWithoutFollowee: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          username: 'test',
          action: 'created',
          user: (mockFollowEvent.data as FollowingData).user
        } as FollowingData
      };
      
      const data = eventWithoutFollowee.data as FollowingData;
      const followeeUrl = data.following ? `https://twitter.com/${data.following.handle}` : '#';
      expect(followeeUrl).toBe('#');
    });
  });

  describe('Time Formatting', () => {
    it('should format timestamp correctly', () => {
      const date = new Date(mockFollowEvent.timestamp);
      const formatted = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('1');
    });

    it('should format different timestamps correctly', () => {
      const date = new Date(mockUnfollowEvent.timestamp);
      const formatted = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2');
    });
  });

  describe('Action Detection', () => {
    it('should detect follow action', () => {
      const data = mockFollowEvent.data as FollowingData;
      const isFollowAction = data.action === 'created' || data.action === 'follow';
      expect(isFollowAction).toBe(true);
    });

    it('should detect unfollow action', () => {
      const data = mockUnfollowEvent.data as FollowingData;
      const isUnfollowAction = data.action === 'deleted' || data.action === 'unfollow';
      expect(isUnfollowAction).toBe(true);
    });

    it('should handle "follow" action string', () => {
      const followEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          action: 'follow'
        } as FollowingData
      };
      
      const data = followEvent.data as FollowingData;
      const isFollowAction = data.action === 'created' || data.action === 'follow';
      expect(isFollowAction).toBe(true);
    });

    it('should handle "unfollow" action string', () => {
      const unfollowEvent: TwitterEvent = {
        ...mockUnfollowEvent,
        data: {
          ...mockUnfollowEvent.data,
          action: 'unfollow'
        } as FollowingData
      };
      
      const data = unfollowEvent.data as FollowingData;
      const isUnfollowAction = data.action === 'deleted' || data.action === 'unfollow';
      expect(isUnfollowAction).toBe(true);
    });
  });

  describe('Avatar Handling', () => {
    it('should handle follower with avatar', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user?.profile?.avatar).toBe('https://example.com/elon-avatar.jpg');
    });

    it('should handle followee with avatar', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.following?.profile?.avatar).toBe('https://example.com/bill-avatar.jpg');
    });

    it('should handle follower without avatar', () => {
      const eventWithoutAvatar: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).user!.profile!,
              avatar: undefined
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutAvatar.data as FollowingData;
      expect(data.user?.profile?.avatar).toBeUndefined();
    });

    it('should handle followee without avatar', () => {
      const eventWithoutAvatar: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).following!.profile!,
              avatar: undefined
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutAvatar.data as FollowingData;
      expect(data.following?.profile?.avatar).toBeUndefined();
    });
  });

  describe('Bio Handling', () => {
    it('should handle follower with bio', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user?.profile?.description?.text).toBe('CEO of Tesla and SpaceX');
    });

    it('should handle followee with bio', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.following?.profile?.description?.text).toBe('Co-founder of Microsoft');
    });

    it('should truncate long bio text', () => {
      const longBio = 'A'.repeat(150);
      const eventWithLongBio: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).user!.profile!,
              description: {
                text: longBio,
                urls: []
              }
            }
          }
        } as FollowingData
      };
      
      const data = eventWithLongBio.data as FollowingData;
      const bioText = data.user?.profile?.description?.text || '';
      const truncated = bioText.slice(0, 100) + (bioText.length > 100 ? '...' : '');
      
      expect(truncated.length).toBeLessThanOrEqual(103);
      expect(truncated).toContain('...');
    });

    it('should not truncate short bio text', () => {
      const data = mockFollowEvent.data as FollowingData;
      const bioText = data.user?.profile?.description?.text || '';
      const truncated = bioText.slice(0, 100) + (bioText.length > 100 ? '...' : '');
      
      expect(truncated).toBe('CEO of Tesla and SpaceX');
      expect(truncated).not.toContain('...');
    });

    it('should handle follower without bio', () => {
      const eventWithoutBio: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).user!.profile!,
              description: undefined
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutBio.data as FollowingData;
      expect(data.user?.profile?.description).toBeUndefined();
    });

    it('should handle followee without bio', () => {
      const eventWithoutBio: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).following!.profile!,
              description: undefined
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutBio.data as FollowingData;
      expect(data.following?.profile?.description).toBeUndefined();
    });
  });

  describe('Metrics Display', () => {
    it('should format follower counts', () => {
      const data = mockFollowEvent.data as FollowingData;
      const followers = data.user?.metrics?.followers;
      
      if (followers !== undefined) {
        const formatted = followers.toLocaleString('en-US');
        expect(formatted).toBe('1,000,000');
      }
    });

    it('should format followee counts', () => {
      const data = mockFollowEvent.data as FollowingData;
      const followers = data.following?.metrics?.followers;
      
      if (followers !== undefined) {
        const formatted = followers.toLocaleString('en-US');
        expect(formatted).toBe('5,000,000');
      }
    });

    it('should handle missing follower metrics', () => {
      const eventWithoutMetrics: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            metrics: undefined
          }
        } as FollowingData
      };
      
      const data = eventWithoutMetrics.data as FollowingData;
      expect(data.user?.metrics).toBeUndefined();
    });

    it('should handle missing followee metrics', () => {
      const eventWithoutMetrics: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            metrics: undefined
          }
        } as FollowingData
      };
      
      const data = eventWithoutMetrics.data as FollowingData;
      expect(data.following?.metrics).toBeUndefined();
    });

    it('should handle partial follower metrics', () => {
      const eventWithPartialMetrics: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            metrics: {
              followers: 1000
            }
          }
        } as FollowingData
      };
      
      const data = eventWithPartialMetrics.data as FollowingData;
      expect(data.user?.metrics?.followers).toBe(1000);
      expect(data.user?.metrics?.following).toBeUndefined();
    });

    it('should handle partial followee metrics', () => {
      const eventWithPartialMetrics: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            metrics: {
              followers: 5000
            }
          }
        } as FollowingData
      };
      
      const data = eventWithPartialMetrics.data as FollowingData;
      expect(data.following?.metrics?.followers).toBe(5000);
      expect(data.following?.metrics?.following).toBeUndefined();
    });
  });

  describe('Name Display', () => {
    it('should use profile name when available for follower', () => {
      const data = mockFollowEvent.data as FollowingData;
      const displayName = data.user?.profile?.name || data.user?.handle;
      expect(displayName).toBe('Elon Musk');
    });

    it('should use profile name when available for followee', () => {
      const data = mockFollowEvent.data as FollowingData;
      const displayName = data.following?.profile?.name || data.following?.handle;
      expect(displayName).toBe('Bill Gates');
    });

    it('should fallback to handle when profile name is missing for follower', () => {
      const eventWithoutName: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).user!.profile!,
              name: ''
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutName.data as FollowingData;
      const displayName = data.user?.profile?.name || data.user?.handle;
      expect(displayName).toBe('elonmusk');
    });

    it('should fallback to handle when profile name is missing for followee', () => {
      const eventWithoutName: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            profile: {
              ...(mockFollowEvent.data as FollowingData).following!.profile!,
              name: ''
            }
          }
        } as FollowingData
      };
      
      const data = eventWithoutName.data as FollowingData;
      const displayName = data.following?.profile?.name || data.following?.handle;
      expect(displayName).toBe('BillGates');
    });
  });

  describe('Edge Cases', () => {
    it('should handle event with minimal data', () => {
      const minimalEvent: TwitterEvent = {
        type: 'follow_created',
        timestamp: '2024-01-01T12:00:00Z',
        primaryId: 'follow-minimal',
        user: {
          username: 'user1',
          displayName: 'User One',
          userId: 'user-1'
        },
        data: {
          username: 'user1',
          action: 'created',
          user: {
            id: 'user-1',
            handle: 'user1'
          },
          following: {
            id: 'user-2',
            handle: 'user2'
          }
        } as FollowingData
      };
      
      const data = minimalEvent.data as FollowingData;
      expect(data.user?.handle).toBe('user1');
      expect(data.following?.handle).toBe('user2');
      expect(data.user?.profile).toBeUndefined();
      expect(data.following?.profile).toBeUndefined();
    });

    it('should handle event with complete data', () => {
      const data = mockFollowEvent.data as FollowingData;
      expect(data.user).toBeDefined();
      expect(data.following).toBeDefined();
      expect(data.user?.profile).toBeDefined();
      expect(data.following?.profile).toBeDefined();
      expect(data.user?.metrics).toBeDefined();
      expect(data.following?.metrics).toBeDefined();
    });
  });

  describe('Badge Display', () => {
    it('should render verified badge for verified follower', () => {
      const data = mockFollowEvent.data as FollowingData;
      const badges = renderBadges(data.user);
      
      expect(badges.length).toBeGreaterThan(0);
      const verifiedBadge = badges.find(b => b.icon === 'check-circle');
      expect(verifiedBadge).toBeDefined();
      expect(verifiedBadge?.color).toBe('text-blue-400');
      expect(verifiedBadge?.label).toBe('Verified');
    });

    it('should render verified badge for verified followee', () => {
      const data = mockFollowEvent.data as FollowingData;
      const badges = renderBadges(data.following);
      
      expect(badges.length).toBeGreaterThan(0);
      const verifiedBadge = badges.find(b => b.icon === 'check-circle');
      expect(verifiedBadge).toBeDefined();
      expect(verifiedBadge?.color).toBe('text-blue-400');
      expect(verifiedBadge?.label).toBe('Verified');
    });

    it('should render private badge for private follower', () => {
      const privateFollowerEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            private: true,
            verified: false
          }
        } as FollowingData
      };
      
      const data = privateFollowerEvent.data as FollowingData;
      const badges = renderBadges(data.user);
      
      expect(badges.length).toBeGreaterThan(0);
      const privateBadge = badges.find(b => b.icon === 'lock');
      expect(privateBadge).toBeDefined();
      expect(privateBadge?.color).toBe('text-slate-400');
      expect(privateBadge?.label).toBe('Private');
    });

    it('should render private badge for private followee', () => {
      const privateFolloweeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            private: true,
            verified: false
          }
        } as FollowingData
      };
      
      const data = privateFolloweeEvent.data as FollowingData;
      const badges = renderBadges(data.following);
      
      expect(badges.length).toBeGreaterThan(0);
      const privateBadge = badges.find(b => b.icon === 'lock');
      expect(privateBadge).toBeDefined();
      expect(privateBadge?.color).toBe('text-slate-400');
      expect(privateBadge?.label).toBe('Private');
    });

    it('should render both verified and private badges when both apply to follower', () => {
      const dualBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            private: true,
            verified: true
          }
        } as FollowingData
      };
      
      const data = dualBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.user);
      
      expect(badges.length).toBe(2);
      expect(badges.find(b => b.icon === 'check-circle')).toBeDefined();
      expect(badges.find(b => b.icon === 'lock')).toBeDefined();
    });

    it('should render both verified and private badges when both apply to followee', () => {
      const dualBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            private: true,
            verified: true
          }
        } as FollowingData
      };
      
      const data = dualBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.following);
      
      expect(badges.length).toBe(2);
      expect(badges.find(b => b.icon === 'check-circle')).toBeDefined();
      expect(badges.find(b => b.icon === 'lock')).toBeDefined();
    });

    it('should not render badges for non-verified, non-private follower', () => {
      const noBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            private: false,
            verified: false
          }
        } as FollowingData
      };
      
      const data = noBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.user);
      
      expect(badges.length).toBe(0);
    });

    it('should not render badges for non-verified, non-private followee', () => {
      const noBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            private: false,
            verified: false
          }
        } as FollowingData
      };
      
      const data = noBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.following);
      
      expect(badges.length).toBe(0);
    });

    it('should handle undefined verified and private fields for follower', () => {
      const undefinedBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          user: {
            ...(mockFollowEvent.data as FollowingData).user!,
            private: undefined,
            verified: undefined
          }
        } as FollowingData
      };
      
      const data = undefinedBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.user);
      
      expect(badges.length).toBe(0);
    });

    it('should handle undefined verified and private fields for followee', () => {
      const undefinedBadgeEvent: TwitterEvent = {
        ...mockFollowEvent,
        data: {
          ...mockFollowEvent.data,
          following: {
            ...(mockFollowEvent.data as FollowingData).following!,
            private: undefined,
            verified: undefined
          }
        } as FollowingData
      };
      
      const data = undefinedBadgeEvent.data as FollowingData;
      const badges = renderBadges(data.following);
      
      expect(badges.length).toBe(0);
    });

    it('should handle null user gracefully', () => {
      const badges = renderBadges(null);
      expect(badges.length).toBe(0);
    });

    it('should handle undefined user gracefully', () => {
      const badges = renderBadges(undefined);
      expect(badges.length).toBe(0);
    });
  });
});
