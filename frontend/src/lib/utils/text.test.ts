import { describe, it, expect } from 'vitest';
import { escapeHtml, highlightMentions } from './text';

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape less than', () => {
    expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
  });

  it('should escape greater than', () => {
    expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("It's working")).toBe('It&#39;s working');
  });

  it('should escape multiple special characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('should return unchanged text without special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('highlightMentions', () => {
  it('should highlight single mention', () => {
    const text = 'Hello @elonmusk!';
    const mentions = [{ username: 'elonmusk' }];
    const result = highlightMentions(text, mentions);
    
    expect(result).toContain('<span class="mention" data-username="elonmusk">@elonmusk</span>');
  });

  it('should highlight multiple mentions', () => {
    const text = 'Hey @elonmusk and @jack!';
    const mentions = [{ username: 'elonmusk' }, { username: 'jack' }];
    const result = highlightMentions(text, mentions);
    
    expect(result).toContain('<span class="mention" data-username="elonmusk">@elonmusk</span>');
    expect(result).toContain('<span class="mention" data-username="jack">@jack</span>');
  });

  it('should escape HTML in text before highlighting', () => {
    const text = '<script>@elonmusk</script>';
    const mentions = [{ username: 'elonmusk' }];
    const result = highlightMentions(text, mentions);
    
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;/script&gt;');
  });

  it('should return escaped text when no mentions provided', () => {
    const text = 'Hello <world>';
    const result = highlightMentions(text, []);
    
    expect(result).toBe('Hello &lt;world&gt;');
  });

  it('should return escaped text when mentions is undefined', () => {
    const text = 'Hello @someone';
    const result = highlightMentions(text, undefined);
    
    expect(result).toBe('Hello @someone');
  });

  it('should handle case-insensitive mentions', () => {
    const text = 'Hello @ElonMusk and @ELONMUSK!';
    const mentions = [{ username: 'elonmusk' }];
    const result = highlightMentions(text, mentions);
    
    expect(result).toContain('<span class="mention"');
  });

  it('should only match whole username with word boundary', () => {
    const text = 'Hello @elon and @elonmusk';
    const mentions = [{ username: 'elon' }];
    const result = highlightMentions(text, mentions);
    
    expect(result).toContain('<span class="mention" data-username="elon">@elon</span>');
    expect(result).not.toContain('<span class="mention" data-username="elon">@elonmusk</span>');
  });
});
