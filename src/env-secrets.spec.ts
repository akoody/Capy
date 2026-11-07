import { normalizeEnvSecret } from './env-secrets';

describe('normalizeEnvSecret', () => {
  it.each([
    [undefined, undefined],
    ['', undefined],
    ['   ', undefined],
    ['""', undefined],
    ['token', 'token'],
    ['  token  ', 'token'],
    ['"token"', 'token'],
    ["'token'", 'token'],
    ['﻿token', 'token'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeEnvSecret(input)).toBe(expected);
  });

  it('keeps inner quotes intact', () => {
    expect(normalizeEnvSecret('a"b')).toBe('a"b');
  });
});
