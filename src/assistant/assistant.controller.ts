import {
  BadRequestException,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssistantService } from './assistant.service';
import { TelegramUser } from '../user.decorator';
import type { UploadedAudioFile } from './uploaded-audio-file';

@Controller('assistant')
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistantService: AssistantService) {}

  @Post('voice')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  async voice(
    @UploadedFile() file: UploadedAudioFile,
    @TelegramUser() telegramUser: { id: number },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Загрузите аудиофайл в поле audio');
    }
    try {
      return await this.assistantService.processVoiceCommand(file, telegramUser);
    } catch (err: unknown) {
      const status =
        err instanceof HttpException
          ? err.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
      const isServerSide = status >= 500 || !(err instanceof HttpException);
      if (isServerSide) {
        this.logger.error(
          `POST assistant/voice -> ${status}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
      throw err;
    }
  }
}
