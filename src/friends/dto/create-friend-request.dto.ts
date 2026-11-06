import { IsMongoId } from 'class-validator';

export class CreateFriendRequestDto {
  @IsMongoId()
  readonly recipientId: string;
}
