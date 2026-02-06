import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTime, formatFullTime } from './formatTime';

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format seconds ago', () => {
    const timestamp = new Date('2024-01-15T11:59:30Z');
    expect(formatTime(timestamp)).toBe('30s ago');
  });

  it('should format minutes ago', () => {
    const timestamp = new Date('2024-01-15T11:55:00Z');
    expect(formatTime(timestamp)).toBe('5m ago');
  });

  it('should format hours ago', () => {
    const timestamp = new Date('2024-01-15T09:00:00Z');
    expect(formatTime(timestamp)).toBe('3h ago');
  });

  it('should format days ago', () => {
    const timestamp = new Date('2024-01-13T12:00:00Z');
    expect(formatTime(timestamp)).toBe('2d ago');
  });

  it('should format as date for older than 7 days', () => {
    const timestamp = new Date('2024-01-01T12:00:00Z');
    const result = formatTime(timestamp);
    expect(result).toMatch(/2024/);
    expect(result).not.toContain('ago');
  });

  it('should handle timestamp as string', () => {
    const timestamp = '2024-01-15T11:59:00Z';
    expect(formatTime(timestamp)).toBe('1m ago');
  });

  it('should handle timestamp as number', () => {
    const timestamp = new Date('2024-01-15T11:59:00Z').getTime();
    expect(formatTime(timestamp)).toBe('1m ago');
  });

  it('should handle exactly 1 minute', () => {
    const timestamp = new Date('2024-01-15T11:59:00Z');
    expect(formatTime(timestamp)).toBe('1m ago');
  });

  it('should handle exactly 1 hour', () => {
    const timestamp = new Date('2024-01-15T11:00:00Z');
    expect(formatTime(timestamp)).toBe('1h ago');
  });

  it('should handle exactly 1 day', () => {
    const timestamp = new Date('2024-01-14T12:00:00Z');
    expect(formatTime(timestamp)).toBe('1d ago');
  });

  it('should handle less than 1 second', () => {
    const timestamp = new Date('2024-01-15T11:59:59.999Z');
    expect(formatTime(timestamp)).toBe('0s ago');
  });
});

describe('formatFullTime', () => {
  it('should format full date and time', () => {
    const timestamp = new Date('2024-01-15T12:00:00Z');
    const result = formatFullTime(timestamp);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/15/);
  });

  it('should handle timestamp as string', () => {
    const timestamp = '2024-01-15T12:00:00Z';
    const result = formatFullTime(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should handle timestamp as number', () => {
    const timestamp = new Date('2024-01-15T12:00:00Z').getTime();
    const result = formatFullTime(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
