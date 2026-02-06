import { describe, it, expect, beforeEach } from 'vitest';
import type { TwitterEvent, ProfileData } from '$lib/types';
import { renderBadges } from '$lib/utils/badges';
import { detectProfileChanges } from '$lib/utils/profileDiff';

describe('ProfileCard Component Logic', () => {
  let mockEvent: TwitterEvent;

  beforeEach(() => {
    mockEvent = {
      type: 'profile_updated',
      timestamp: '2024-01-01T12:00:00Z',
      primaryId: 'profile-123',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-123'
      },
      data: {
        username: 'elonmusk',
        action: 'updated',
        user: {
          id: 'user-123',
          handle: 'elonmusk',
          private: false,
          verified: true,
          jointed_at: 1243814400000,
          profile: {
            name: 'Elon Musk',
            location: 'San Francisco, CA',
            avatar: 'https://example.com/avatar.jpg',
            banner: 'https://example.com/banner.jpg',
            description: {
              text: 'CEO of Tesla and SpaceX',
              urls: []
            },
            url: {
              name: 'tesla.com',
              url: 'https://tesla.com',
              tco: 't.co/abc'
            }
          },
          metrics: {
            following: 100,
            followers: 1000000,
            tweets: 5000,
            media: 200
          }
        }
      } as ProfileData
    };
  });

  describe('Profile Data Extraction', () => {
    it('should extract user data from event', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user).toBeDefined();
      expect(data.user?.handle).toBe('elonmusk');
    });

    it('should extract profile information', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.name).toBe('Elon Musk');
      expect(data.user?.profile?.location).toBe('San Francisco, CA');
    });

    it('should extract avatar and banner', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.avatar).toBe('https://example.com/avatar.jpg');
      expect(data.user?.profile?.banner).toBe('https://example.com/banner.jpg');
    });

    it('should extract bio', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.description?.text).toBe('CEO of Tesla and SpaceX');
    });

    it('should extract metrics', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.metrics?.followers).toBe(1000000);
      expect(data.user?.metrics?.following).toBe(100);
      expect(data.user?.metrics?.tweets).toBe(5000);
    });
  });

  describe('URL Generation', () => {
    it('should generate correct profile URL', () => {
      const data = mockEvent.data as ProfileData;
      const profileUrl = `https://twitter.com/${data.user?.handle}`;
      expect(profileUrl).toBe('https://twitter.com/elonmusk');
    });

    it('should handle missing user', () => {
      const eventWithoutUser: TwitterEvent = {
        ...mockEvent,
        data: {
          username: 'test',
          action: 'updated'
        } as ProfileData
      };
      
      const data = eventWithoutUser.data as ProfileData;
      const profileUrl = data.user ? `https://twitter.com/${data.user.handle}` : '#';
      expect(profileUrl).toBe('#');
    });
  });

  describe('Time Formatting', () => {
    it('should format timestamp correctly', () => {
      const date = new Date(mockEvent.timestamp);
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

    it('should format joined date correctly', () => {
      const data = mockEvent.data as ProfileData;
      const joinedDate = data.user?.jointed_at;
      
      if (joinedDate) {
        const formatted = new Date(joinedDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        });
        
        expect(formatted).toBeTruthy();
        expect(formatted).toContain('Jun');
        expect(formatted).toContain('2009');
      }
    });
  });

  describe('Action Detection', () => {
    it('should detect profile update action', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.action).toBe('updated');
    });

    it('should detect new profile action', () => {
      const newProfileEvent: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          action: 'created'
        } as ProfileData
      };
      
      const data = newProfileEvent.data as ProfileData;
      expect(data.action).toBe('created');
    });

    it('should detect profile changes', () => {
      const data = mockEvent.data as ProfileData;
      const hasProfileChanges = data.action === 'updated' && !!data.user?.profile;
      expect(hasProfileChanges).toBe(true);
    });
  });

  describe('Pinned Tweets', () => {
    it('should handle profile with pinned tweets', () => {
      const profileWithPinned: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          pinned: [
            {
              id: 'pinned-123',
              type: 'tweet',
              created_at: '2024-01-01T10:00:00Z',
              body: {
                text: 'This is my pinned tweet!'
              },
              author: {
                handle: 'elonmusk',
                profile: {
                  avatar: 'https://example.com/avatar.jpg',
                  name: 'Elon Musk'
                }
              }
            }
          ]
        } as ProfileData
      };
      
      const data = profileWithPinned.data as ProfileData;
      expect(data.pinned).toBeDefined();
      expect(data.pinned).toHaveLength(1);
      expect(data.pinned?.[0].body.text).toBe('This is my pinned tweet!');
    });

    it('should handle profile without pinned tweets', () => {
      const data = mockEvent.data as ProfileData;
      const pinnedTweets = data.pinned || [];
      expect(pinnedTweets).toHaveLength(0);
    });

    it('should handle pinned tweet with media', () => {
      const profileWithPinnedMedia: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          pinned: [
            {
              id: 'pinned-123',
              type: 'tweet',
              created_at: '2024-01-01T10:00:00Z',
              body: {
                text: 'Check out this image!'
              },
              media: {
                images: ['https://example.com/image.jpg']
              }
            }
          ]
        } as ProfileData
      };
      
      const data = profileWithPinnedMedia.data as ProfileData;
      expect(data.pinned?.[0].media?.images).toBeDefined();
      expect(data.pinned?.[0].media?.images).toHaveLength(1);
    });
  });

  describe('Profile Metadata', () => {
    it('should handle profile with location', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.location).toBe('San Francisco, CA');
    });

    it('should handle profile without location', () => {
      const profileWithoutLocation: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              location: undefined
            }
          }
        } as ProfileData
      };
      
      const data = profileWithoutLocation.data as ProfileData;
      expect(data.user?.profile?.location).toBeUndefined();
    });

    it('should handle profile with URL', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.url).toBeDefined();
      expect(data.user?.profile?.url?.url).toBe('https://tesla.com');
      expect(data.user?.profile?.url?.name).toBe('tesla.com');
    });

    it('should handle profile without URL', () => {
      const profileWithoutUrl: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              url: undefined
            }
          }
        } as ProfileData
      };
      
      const data = profileWithoutUrl.data as ProfileData;
      expect(data.user?.profile?.url).toBeUndefined();
    });
  });

  describe('Metrics Display', () => {
    it('should format large follower counts', () => {
      const data = mockEvent.data as ProfileData;
      const followers = data.user?.metrics?.followers;
      
      if (followers !== undefined) {
        const formatted = followers.toLocaleString('en-US');
        expect(formatted).toBe('1,000,000');
      }
    });

    it('should handle missing metrics', () => {
      const profileWithoutMetrics: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            metrics: undefined
          }
        } as ProfileData
      };
      
      const data = profileWithoutMetrics.data as ProfileData;
      expect(data.user?.metrics).toBeUndefined();
    });

    it('should handle partial metrics', () => {
      const profileWithPartialMetrics: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            metrics: {
              followers: 1000
            }
          }
        } as ProfileData
      };
      
      const data = profileWithPartialMetrics.data as ProfileData;
      expect(data.user?.metrics?.followers).toBe(1000);
      expect(data.user?.metrics?.following).toBeUndefined();
      expect(data.user?.metrics?.tweets).toBeUndefined();
    });
  });

  describe('Avatar and Banner Handling', () => {
    it('should handle profile with avatar', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should handle profile without avatar', () => {
      const profileWithoutAvatar: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              avatar: undefined
            }
          }
        } as ProfileData
      };
      
      const data = profileWithoutAvatar.data as ProfileData;
      expect(data.user?.profile?.avatar).toBeUndefined();
    });

    it('should handle profile with banner', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.banner).toBe('https://example.com/banner.jpg');
    });

    it('should handle profile without banner', () => {
      const profileWithoutBanner: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              banner: undefined
            }
          }
        } as ProfileData
      };
      
      const data = profileWithoutBanner.data as ProfileData;
      expect(data.user?.profile?.banner).toBeUndefined();
    });
  });

  describe('Bio Handling', () => {
    it('should handle profile with bio', () => {
      const data = mockEvent.data as ProfileData;
      expect(data.user?.profile?.description?.text).toBe('CEO of Tesla and SpaceX');
    });

    it('should handle profile without bio', () => {
      const profileWithoutBio: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              description: undefined
            }
          }
        } as ProfileData
      };
      
      const data = profileWithoutBio.data as ProfileData;
      expect(data.user?.profile?.description).toBeUndefined();
    });

    it('should handle empty bio', () => {
      const profileWithEmptyBio: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              description: {
                text: '',
                urls: []
              }
            }
          }
        } as ProfileData
      };
      
      const data = profileWithEmptyBio.data as ProfileData;
      expect(data.user?.profile?.description?.text).toBe('');
    });
  });

  describe('Badge Display', () => {
    it('should display verified badge for verified users', () => {
      const data = mockEvent.data as ProfileData;
      const badges = renderBadges(data.user);
      
      expect(badges).toBeDefined();
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.some(b => b.icon === 'check-circle' && b.label === 'Verified')).toBe(true);
    });

    it('should display private badge for private users', () => {
      const privateUserEvent: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            private: true,
            verified: false
          }
        } as ProfileData
      };
      
      const data = privateUserEvent.data as ProfileData;
      const badges = renderBadges(data.user);
      
      expect(badges).toBeDefined();
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.some(b => b.icon === 'lock' && b.label === 'Private')).toBe(true);
    });

    it('should display both verified and private badges when applicable', () => {
      const dualBadgeEvent: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            private: true,
            verified: true
          }
        } as ProfileData
      };
      
      const data = dualBadgeEvent.data as ProfileData;
      const badges = renderBadges(data.user);
      
      expect(badges).toBeDefined();
      expect(badges.length).toBe(2);
      expect(badges.some(b => b.icon === 'check-circle')).toBe(true);
      expect(badges.some(b => b.icon === 'lock')).toBe(true);
    });

    it('should not display badges for non-verified, non-private users', () => {
      const noBadgeEvent: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          user: {
            ...(mockEvent.data as ProfileData).user!,
            private: false,
            verified: false
          }
        } as ProfileData
      };
      
      const data = noBadgeEvent.data as ProfileData;
      const badges = renderBadges(data.user);
      
      expect(badges).toBeDefined();
      expect(badges.length).toBe(0);
    });

    it('should use correct colors for badges', () => {
      const data = mockEvent.data as ProfileData;
      const badges = renderBadges(data.user);
      
      const verifiedBadge = badges.find(b => b.icon === 'check-circle');
      expect(verifiedBadge?.color).toBe('text-blue-400');
    });
  });

  describe('Profile Change Indicators', () => {
    it('should detect avatar changes', () => {
      const eventWithChanges: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/old-avatar.jpg',
              banner: 'https://example.com/banner.jpg',
              description: {
                text: 'CEO of Tesla and SpaceX'
              }
            }
          },
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              avatar: 'https://example.com/new-avatar.jpg'
            }
          }
        } as ProfileData
      };
      
      const data = eventWithChanges.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some(c => c.field === 'avatar' && c.label === 'Avatar updated')).toBe(true);
    });

    it('should detect bio changes', () => {
      const eventWithBioChange: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              banner: 'https://example.com/banner.jpg',
              description: {
                text: 'Old bio text'
              }
            }
          },
          user: {
            ...(mockEvent.data as ProfileData).user!,
            profile: {
              ...(mockEvent.data as ProfileData).user!.profile!,
              description: {
                text: 'CEO of Tesla and SpaceX'
              }
            }
          }
        } as ProfileData
      };
      
      const data = eventWithBioChange.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.some(c => c.field === 'bio' && c.label === 'Bio changed')).toBe(true);
    });

    it('should detect name changes', () => {
      const eventWithNameChange: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Old Name',
              avatar: 'https://example.com/avatar.jpg',
              banner: 'https://example.com/banner.jpg',
              description: {
                text: 'CEO of Tesla and SpaceX'
              }
            }
          }
        } as ProfileData
      };
      
      const data = eventWithNameChange.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.some(c => c.field === 'name' && c.label === 'Name changed')).toBe(true);
    });

    it('should detect banner changes', () => {
      const eventWithBannerChange: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              banner: 'https://example.com/old-banner.jpg',
              description: {
                text: 'CEO of Tesla and SpaceX'
              }
            }
          }
        } as ProfileData
      };
      
      const data = eventWithBannerChange.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.some(c => c.field === 'banner' && c.label === 'Banner updated')).toBe(true);
    });

    it('should detect multiple changes', () => {
      const eventWithMultipleChanges: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Old Name',
              avatar: 'https://example.com/old-avatar.jpg',
              banner: 'https://example.com/old-banner.jpg',
              description: {
                text: 'Old bio'
              }
            }
          }
        } as ProfileData
      };
      
      const data = eventWithMultipleChanges.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.length).toBe(4); // All fields changed
      expect(changes.some(c => c.field === 'avatar')).toBe(true);
      expect(changes.some(c => c.field === 'bio')).toBe(true);
      expect(changes.some(c => c.field === 'name')).toBe(true);
      expect(changes.some(c => c.field === 'banner')).toBe(true);
    });

    it('should return empty array when no before data present', () => {
      const data = mockEvent.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.length).toBe(0);
    });

    it('should return empty array when no changes detected', () => {
      const eventWithNoChanges: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          before: {
            id: 'user-123',
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              banner: 'https://example.com/banner.jpg',
              description: {
                text: 'CEO of Tesla and SpaceX'
              }
            }
          }
        } as ProfileData
      };
      
      const data = eventWithNoChanges.data as ProfileData;
      const changes = detectProfileChanges(data.before, data.user);
      
      expect(changes).toBeDefined();
      expect(changes.length).toBe(0);
    });
  });
});
