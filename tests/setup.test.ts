import * as fc from 'fast-check';

describe('Project Setup', () => {
  test('Jest is configured correctly', () => {
    expect(true).toBe(true);
  });

  test('fast-check is available', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      })
    );
  });

  test('TypeScript strict mode is working', () => {
    const value: string = 'test';
    expect(value).toBe('test');
  });
});
