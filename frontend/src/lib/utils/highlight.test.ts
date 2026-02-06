import { describe, it, expect } from 'vitest';
import { highlightSearchTerm } from './highlight';

describe('highlightSearchTerm', () => {
  it('should return escaped HTML when no search query', () => {
    const result = highlightSearchTerm('Hello <script>alert("xss")</script>', '');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should highlight single occurrence', () => {
    const result = highlightSearchTerm('Hello world', 'world');
    expect(result).toContain('<mark class="search-highlight">world</mark>');
  });

  it('should highlight multiple occurrences', () => {
    const result = highlightSearchTerm('Hello world, world is great', 'world');
    const matches = result.match(/<mark class="search-highlight">world<\/mark>/g);
    expect(matches).toHaveLength(2);
  });

  it('should be case insensitive', () => {
    const result = highlightSearchTerm('Hello World', 'world');
    expect(result).toContain('<mark class="search-highlight">World</mark>');
  });

  it('should escape HTML in text', () => {
    const result = highlightSearchTerm('<div>Hello</div>', 'Hello');
    expect(result).toContain('&lt;div&gt;');
    expect(result).toContain('<mark class="search-highlight">Hello</mark>');
  });

  it('should handle special regex characters in search query', () => {
    const result = highlightSearchTerm('Price is $100', '$100');
    expect(result).toContain('<mark class="search-highlight">$100</mark>');
  });

  it('should handle empty text', () => {
    const result = highlightSearchTerm('', 'test');
    expect(result).toBe('');
  });

  it('should handle whitespace in search query', () => {
    const result = highlightSearchTerm('Hello world', '  world  ');
    expect(result).toContain('<mark class="search-highlight">world</mark>');
  });

  it('should preserve original case in highlights', () => {
    const result = highlightSearchTerm('Bitcoin and BITCOIN', 'bitcoin');
    expect(result).toContain('<mark class="search-highlight">Bitcoin</mark>');
    expect(result).toContain('<mark class="search-highlight">BITCOIN</mark>');
  });

  it('should handle partial word matches', () => {
    const result = highlightSearchTerm('cryptocurrency', 'crypto');
    expect(result).toContain('<mark class="search-highlight">crypto</mark>currency');
  });
});
