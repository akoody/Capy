import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { TelegramUser } from '../auth/telegram-user.decorator';
import { UsersService } from '../users/users.service';
import type { TelegramUserPayload } from '../auth/telegram-init-data';

@Controller('journal')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    private readonly usersService: UsersService,
  ) {}

  private async getUserIdFromTelegram(telegramUser: TelegramUserPayload): Promise<string> {
    const user = await this.usersService.findOrCreateByTelegramUser(telegramUser);
    return user._id.toString();
  }

  @Post()
  async create(
    @Body() createJournalEntryDto: CreateJournalEntryDto,
    @TelegramUser() telegramUser: TelegramUserPayload,
  ) {
    try {
      const userId = await this.getUserIdFromTelegram(telegramUser);
      
      const entryData: any = {
        ...createJournalEntryDto,
        userId,
      };
      
      if (entryData.date && typeof entryData.date === 'string') {
        entryData.date = new Date(entryData.date);
      }
      
      return this.journalService.create(entryData);
    } catch (error) {
      console.error('Error creating journal entry:', error);
      throw error;
    }
  }

  @Get()
  async findAll(@TelegramUser() telegramUser: TelegramUserPayload) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    return this.journalService.findAllForUser(userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TelegramUser() telegramUser: TelegramUserPayload,
  ) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    return this.journalService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TelegramUser() telegramUser: TelegramUserPayload,
    @Body() updateJournalEntryDto: UpdateJournalEntryDto,
  ) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    
    const updateData: any = { ...updateJournalEntryDto };
    if (updateData.date && typeof updateData.date === 'string') {
      updateData.date = new Date(updateData.date);
    }
    
    return this.journalService.update(id, userId, updateData);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @TelegramUser() telegramUser: TelegramUserPayload,
  ) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    return this.journalService.remove(id, userId);
  }

  @Post('analyze')
  async analyze(@TelegramUser() telegramUser: TelegramUserPayload) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    const analysis = await this.journalService.analyzeEntries(userId);
    return { analysis };
  }
}

