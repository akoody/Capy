import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TransactionCategory,
  TransactionCategoryDocument,
} from './schemas/transaction-category.schema';
import { CreateTransactionCategoryDto } from './dto/create-transaction-category.dto';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class TransactionCategoriesService {
  constructor(
    @InjectModel(TransactionCategory.name)
    private categoryModel: Model<TransactionCategoryDocument>,
  ) {}

  async findAllForUser(userId: string): Promise<TransactionCategory[]> {
    return this.categoryModel
      .find({ user: new Types.ObjectId(userId), archived: false })
      .sort({ name: 1 })
      .exec();
  }

  /** Для голоса и промпта: название, тип, описание. */
  async listForVoiceContext(
    userId: string,
    limit = 50,
  ): Promise<{ name: string; kind: string; description: string | null }[]> {
    const rows = await this.categoryModel
      .find({ user: new Types.ObjectId(userId), archived: false })
      .select('name kind description')
      .limit(limit)
      .lean()
      .exec();
    return rows.map((r) => ({
      name: r.name,
      kind: r.kind,
      description: r.description?.trim() || null,
    }));
  }

  async findOneForUser(
    userId: string,
    id: string,
  ): Promise<TransactionCategoryDocument> {
    const doc = await this.categoryModel
      .findOne({
        _id: id,
        user: new Types.ObjectId(userId),
        archived: false,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('Категория не найдена');
    }
    return doc;
  }

  async create(
    userId: string,
    dto: CreateTransactionCategoryDto,
  ): Promise<TransactionCategory> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Укажите название категории');
    }
    const dup = await this.categoryModel
      .findOne({
        user: new Types.ObjectId(userId),
        archived: false,
        name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
      })
      .exec();
    if (dup) {
      throw new ConflictException('Категория с таким названием уже есть');
    }
    const doc = new this.categoryModel({
      user: new Types.ObjectId(userId),
      name,
      kind: dto.kind,
      description: dto.description?.trim() || undefined,
    });
    return doc.save();
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionCategoryDto,
  ): Promise<TransactionCategory> {
    const doc = await this.findOneForUser(userId, id);
    if (dto.name != null) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Пустое название');
      }
      const dup = await this.categoryModel
        .findOne({
          user: new Types.ObjectId(userId),
          archived: false,
          _id: { $ne: doc._id },
          name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        })
        .exec();
      if (dup) {
        throw new ConflictException('Категория с таким названием уже есть');
      }
      doc.name = name;
    }
    if (dto.kind != null) doc.kind = dto.kind;
    if (dto.description !== undefined) {
      doc.description = dto.description?.trim() || undefined;
    }
    if (dto.archived != null) doc.archived = dto.archived;
    return doc.save();
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.update(userId, id, { archived: true });
  }

  /**
   * Подставить каноническое имя категории по подсказке (голос / опечатки).
   */
  async resolveForVoice(
    userId: string,
    txType: 'expense' | 'income',
    hint: string | null | undefined,
  ): Promise<string> {
    const fallback = txType === 'expense' ? 'Разное' : 'Доход';
    const h = hint?.trim();
    if (!h) return fallback;

    const list = await this.findAllForUser(userId);
    const applicable = list.filter(
      (c) => c.kind === 'both' || c.kind === txType,
    );
    if (applicable.length === 0) return h;

    const hl = h.toLowerCase();
    const exact = applicable.find((c) => c.name.toLowerCase() === hl);
    if (exact) return exact.name;

    const partial = applicable.find(
      (c) =>
        c.name.toLowerCase().includes(hl) || hl.includes(c.name.toLowerCase()),
    );
    if (partial) return partial.name;

    const byDesc = applicable.find((c) => {
      const d = c.description?.toLowerCase().trim();
      if (!d) return false;
      return d.includes(hl) || hl.includes(d) || this.descTokensMatch(d, hl);
    });
    if (byDesc) return byDesc.name;

    return h;
  }

  private descTokensMatch(desc: string, hl: string): boolean {
    const tokens = desc.split(/[\s,.;]+/).filter((t) => t.length > 2);
    return tokens.some((t) => hl.includes(t) || t.includes(hl));
  }

  /**
   * После транзакции: если категории с таким именем нет — создать (учёт в справочнике).
   */
  async ensureFromTransaction(
    userId: string,
    categoryName: string,
    txType: 'expense' | 'income',
  ): Promise<void> {
    const name = categoryName.trim();
    if (!name) return;
    const exists = await this.categoryModel
      .findOne({
        user: new Types.ObjectId(userId),
        archived: false,
        name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
      })
      .exec();
    if (exists) return;
    const kind: 'expense' | 'income' | 'both' = txType;
    await new this.categoryModel({
      user: new Types.ObjectId(userId),
      name,
      kind,
    }).save();
  }
}
