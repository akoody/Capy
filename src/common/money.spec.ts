import { signedWalletDelta, toMajor, toMinor } from './money';

describe('money', () => {
  it.each([
    [19.99, 1999],
    [0.07, 7],
    [1.1, 110],
    [4.35, 435],
    [1000.5, 100050],
  ])('converts %p to %p minor units without float noise', (major, minor) => {
    expect(toMinor(major)).toBe(minor);
    expect(toMajor(minor)).toBe(major);
  });

  it('rejects amounts beyond the safe integer range', () => {
    expect(() => toMinor(Number.MAX_SAFE_INTEGER)).toThrow('out of range');
  });

  it('signs wallet movements', () => {
    expect(signedWalletDelta('credit', 5)).toBe(5);
    expect(signedWalletDelta('debit', 5)).toBe(-5);
  });
});
