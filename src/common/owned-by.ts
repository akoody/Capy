import { NotFoundException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/**
 * Фильтр «документ с этим id, принадлежащий этому пользователю».
 * Чужой, несуществующий и некорректный id дают один и тот же 404,
 * чтобы по ответу нельзя было узнать, существует ли чужая запись.
 */
export function ownedBy(
  userId: string,
  id: string,
  ownerField = 'user',
): Record<string, string> {
  if (!isValidObjectId(id)) {
    throw new NotFoundException();
  }
  return { _id: id, [ownerField]: userId };
}

/** Бросает 404, если документ не найден в пределах владельца. */
export function orNotFound<T>(doc: T | null | undefined, what: string): T {
  if (doc == null) {
    throw new NotFoundException(`${what} not found`);
  }
  return doc;
}
