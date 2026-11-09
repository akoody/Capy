import { AccountThrottlerGuard } from './account-throttler.guard';

class Exposed extends AccountThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('AccountThrottlerGuard', () => {
  const guard = new Exposed(
    [{ ttl: 1000, limit: 1 }],
    {} as never,
    {} as never,
  );

  it('counts requests per account when one is known', async () => {
    await expect(
      guard.tracker({ account: { userId: 'u1' }, ip: '1.1.1.1' }),
    ).resolves.toBe('u1');
  });

  it('falls back to the address on public routes', async () => {
    await expect(guard.tracker({ ip: '1.1.1.1' })).resolves.toBe('1.1.1.1');
  });
});
