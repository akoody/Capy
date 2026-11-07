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
import { CurrentUserId } from '../auth/current-account';

@Controller('journal')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
  ) {}

  @Post()
  async create(
    @Body() createJournalEntryDto: CreateJournalEntryDto,
    @CurrentUserId() userId: string,
  ) {
    try {
      
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
  async findAll(@CurrentUserId() userId: string) {
    return this.journalService.findAllForUser(userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.journalService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() updateJournalEntryDto: UpdateJournalEntryDto,
  ) {
    
    const updateData: any = { ...updateJournalEntryDto };
    if (updateData.date && typeof updateData.date === 'string') {
      updateData.date = new Date(updateData.date);
    }
    
    return this.journalService.update(id, userId, updateData);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.journalService.remove(id, userId);
  }

  @Post('analyze')
  async analyze(@CurrentUserId() userId: string) {
    const analysis = await this.journalService.analyzeEntries(userId);
    return { analysis };
  }
}

