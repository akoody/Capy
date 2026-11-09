import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './current-account';

/**
 * Лимит запросов на аккаунт, а не на IP: у мобильных операторов за одним
 * адресом сидят тысячи пользователей. Срабатывает после проверки подписи.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const { account, ip } = req as unknown as AuthenticatedRequest;
    return Promise.resolve(account?.userId ?? ip ?? 'unknown');
  }
}
