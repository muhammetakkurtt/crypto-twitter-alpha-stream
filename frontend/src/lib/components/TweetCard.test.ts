import { describe, it, expect, beforeEach } from 'vitest';
import type { TwitterEvent, PostData } from '$lib/types';
import { filtersStore } from '$lib/stores/filters.svelte';

describe('TweetCard Component Logic', () => {
  let mockEvent: TwitterEvent;

  beforeEach(() => {
    filtersStore.clearAll();
    
    mockEvent = {
      type: 'post_created',
      timestamp: '2024-01-01T12:00:00Z',
      primaryId: 'tweet-123',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-123'
      },
      data: {
        tweetId: 'tweet-123',
        username: 'elonmusk',
        action: 'created',
        tweet: {
          id: 'tweet-123',
          type: 'tweet',
          created_at: '2024-01-01T12:00:00Z',
          body: {
            text: 'Hello @world! This is a test tweet.',
            mentions: ['world']
          },
          author: {
            handle: 'elonmusk',
            id: 'user-123',
            verified: true,
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              bio: 'CEO of Tesla'
            }
          },
          metrics: {
            likes: 1000,
            retweets: 500,
            replies: 250,
            views: 10000
          }
        }
      } as PostData
    };
  });


  describe('Tweet Data Extraction', () => {
    it('should extract tweet data from event', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet).toBeDefined();
      expect(data.tweet?.id).toBe('tweet-123');
    });

    it('should extract author information', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet?.author.handle).toBe('elonmusk');
      expect(data.tweet?.author.profile?.name).toBe('Elon Musk');
      expect(data.tweet?.author.verified).toBe(true);
    });

    it('should extract tweet text', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet?.body.text).toBe('Hello @world! This is a test tweet.');
    });

    it('should extract mentions', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet?.body.mentions).toEqual(['world']);
    });

    it('should extract metrics', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet?.metrics?.likes).toBe(1000);
      expect(data.tweet?.metrics?.retweets).toBe(500);
      expect(data.tweet?.metrics?.replies).toBe(250);
    });
  });

  describe('URL Generation', () => {
    it('should generate correct tweet URL', () => {
      const data = mockEvent.data as PostData;
      const tweetUrl = `https://twitter.com/${data.tweet?.author.handle}/status/${data.tweet?.id}`;
      expect(tweetUrl).toBe('https://twitter.com/elonmusk/status/tweet-123');
    });

    it('should generate correct author URL', () => {
      const data = mockEvent.data as PostData;
      const authorUrl = `https://twitter.com/${data.tweet?.author.handle}`;
      expect(authorUrl).toBe('https://twitter.com/elonmusk');
    });
  });


  describe('HTML Escaping', () => {
    it('should escape HTML in text', () => {
      const escapeHtml = (text: string): string => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      const maliciousText = '<script>alert("xss")</script>';
      const escaped = escapeHtml(maliciousText);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    it('should preserve regular text', () => {
      const escapeHtml = (text: string): string => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      const normalText = 'Hello world!';
      const escaped = escapeHtml(normalText);
      expect(escaped).toBe('Hello world!');
    });
  });

  describe('Mention Highlighting', () => {
    it('should highlight mentions in text', () => {
      const highlightMentions = (text: string, mentions?: string[]): string => {
        if (!text) return '';
        if (!mentions || mentions.length === 0) return text;
        
        let result = text;
        mentions.forEach(mention => {
          const mentionPattern = new RegExp(`@${mention}\\b`, 'gi');
          result = result.replace(
            mentionPattern,
            `<span class="mention" data-username="${mention}">@${mention}</span>`
          );
        });
        return result;
      };

      const text = 'Hello @world!';
      const mentions = ['world'];
      const highlighted = highlightMentions(text, mentions);
      
      expect(highlighted).toContain('<span class="mention"');
      expect(highlighted).toContain('data-username="world"');
      expect(highlighted).toContain('@world</span>');
    });

    it('should handle multiple mentions', () => {
      const highlightMentions = (text: string, mentions?: string[]): string => {
        if (!text) return '';
        if (!mentions || mentions.length === 0) return text;
        
        let result = text;
        mentions.forEach(mention => {
          const mentionPattern = new RegExp(`@${mention}\\b`, 'gi');
          result = result.replace(
            mentionPattern,
            `<span class="mention" data-username="${mention}">@${mention}</span>`
          );
        });
        return result;
      };

      const text = 'Hello @alice and @bob!';
      const mentions = ['alice', 'bob'];
      const highlighted = highlightMentions(text, mentions);
      
      expect(highlighted).toContain('data-username="alice"');
      expect(highlighted).toContain('data-username="bob"');
    });


    it('should return original text when no mentions', () => {
      const highlightMentions = (text: string, mentions?: string[]): string => {
        if (!text) return '';
        if (!mentions || mentions.length === 0) return text;
        
        let result = text;
        mentions.forEach(mention => {
          const mentionPattern = new RegExp(`@${mention}\\b`, 'gi');
          result = result.replace(
            mentionPattern,
            `<span class="mention" data-username="${mention}">@${mention}</span>`
          );
        });
        return result;
      };

      const text = 'Hello world!';
      const highlighted = highlightMentions(text, []);
      expect(highlighted).toBe('Hello world!');
    });
  });

  describe('Mention Click Handler', () => {
    it('should toggle user filter when mention is clicked', () => {
      expect(filtersStore.users).toHaveLength(0);
      
      filtersStore.toggleUser('world');
      expect(filtersStore.users).toContain('world');
      
      filtersStore.toggleUser('world');
      expect(filtersStore.users).not.toContain('world');
    });

    it('should add multiple users to filter', () => {
      filtersStore.toggleUser('alice');
      filtersStore.toggleUser('bob');
      
      expect(filtersStore.users).toContain('alice');
      expect(filtersStore.users).toContain('bob');
      expect(filtersStore.users).toHaveLength(2);
    });
  });

  describe('Media Grid Layout', () => {
    it('should use single column for 1 image', () => {
      const imageCount = 1;
      const gridClass = imageCount === 1 ? 'grid-cols-1' : 'grid-cols-2';
      expect(gridClass).toBe('grid-cols-1');
    });

    it('should use two columns for 2 images', () => {
      const imageCount = 2;
      const gridClass = imageCount === 2 ? 'grid-cols-2' : 'grid-cols-1';
      expect(gridClass).toBe('grid-cols-2');
    });

    it('should use two columns for 3 images', () => {
      const imageCount = 3;
      const gridClass = imageCount === 3 ? 'grid-cols-2' : 'grid-cols-1';
      expect(gridClass).toBe('grid-cols-2');
    });

    it('should use two columns for 4 images', () => {
      const imageCount = 4;
      const gridClass = imageCount >= 4 ? 'grid-cols-2' : 'grid-cols-1';
      expect(gridClass).toBe('grid-cols-2');
    });
  });


  describe('Image Modal State', () => {
    it('should initialize with modal closed', () => {
      let showImageModal = false;
      let selectedImage = '';
      
      expect(showImageModal).toBe(false);
      expect(selectedImage).toBe('');
    });

    it('should open modal with selected image', () => {
      let showImageModal = false;
      let selectedImage = '';
      
      const imageUrl = 'https://example.com/image.jpg';
      selectedImage = imageUrl;
      showImageModal = true;
      
      expect(showImageModal).toBe(true);
      expect(selectedImage).toBe(imageUrl);
    });

    it('should close modal and clear selected image', () => {
      let showImageModal = true;
      let selectedImage = 'https://example.com/image.jpg';
      
      showImageModal = false;
      selectedImage = '';
      
      expect(showImageModal).toBe(false);
      expect(selectedImage).toBe('');
    });
  });

  describe('Time Formatting', () => {
    it('should format timestamp correctly', () => {
      const timestamp = '2024-01-01T12:00:00Z';
      const date = new Date(timestamp);
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

    it('should handle missing timestamp', () => {
      const timestamp = undefined;
      const formatted = timestamp ? new Date(timestamp).toLocaleString() : '';
      expect(formatted).toBe('');
    });
  });

  describe('Media Support', () => {
    it('should detect images in tweet', () => {
      const tweetWithImages: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          tweet: {
            ...(mockEvent.data as PostData).tweet!,
            media: {
              images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
            }
          }
        } as PostData
      };
      
      const data = tweetWithImages.data as PostData;
      expect(data.tweet?.media?.images).toBeDefined();
      expect(data.tweet?.media?.images).toHaveLength(2);
    });


    it('should detect videos in tweet', () => {
      const tweetWithVideo: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          tweet: {
            ...(mockEvent.data as PostData).tweet!,
            media: {
              videos: ['https://example.com/video.mp4']
            }
          }
        } as PostData
      };
      
      const data = tweetWithVideo.data as PostData;
      expect(data.tweet?.media?.videos).toBeDefined();
      expect(data.tweet?.media?.videos).toHaveLength(1);
    });

    it('should handle tweet without media', () => {
      const data = mockEvent.data as PostData;
      const hasMedia = data.tweet?.media?.images || data.tweet?.media?.videos;
      expect(hasMedia).toBeUndefined();
    });
  });

  describe('Quoted Tweet Support', () => {
    it('should detect quoted tweet', () => {
      const tweetWithQuote: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          tweet: {
            ...(mockEvent.data as PostData).tweet!,
            subtweet: {
              id: 'quoted-123',
              body: { text: 'This is a quoted tweet' },
              author: {
                handle: 'quoteduser',
                profile: { name: 'Quoted User' }
              }
            }
          }
        } as PostData
      };
      
      const data = tweetWithQuote.data as PostData;
      expect(data.tweet?.subtweet).toBeDefined();
      expect(data.tweet?.subtweet.body.text).toBe('This is a quoted tweet');
    });

    it('should handle tweet without quote', () => {
      const data = mockEvent.data as PostData;
      expect(data.tweet?.subtweet).toBeUndefined();
    });
  });

  describe('URL Support', () => {
    it('should detect URLs in tweet', () => {
      const tweetWithUrls: TwitterEvent = {
        ...mockEvent,
        data: {
          ...mockEvent.data,
          tweet: {
            ...(mockEvent.data as PostData).tweet!,
            body: {
              text: 'Check out this link',
              urls: [
                { name: 'Example', url: 'https://example.com', tco: 't.co/abc' }
              ]
            }
          }
        } as PostData
      };
      
      const data = tweetWithUrls.data as PostData;
      expect(data.tweet?.body.urls).toBeDefined();
      expect(data.tweet?.body.urls).toHaveLength(1);
      expect(data.tweet?.body.urls?.[0].url).toBe('https://example.com');
    });
  });
});
