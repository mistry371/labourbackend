import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService, StorageFolder } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/v1/storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-url')
  getSignedUrl(
    @CurrentUser() user: User,
    @Body() body: { folder: StorageFolder; fileType: string },
  ) {
    return this.storageService.getSignedUploadUrl(body.folder, body.fileType, user.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new Error('No file provided');
    const ext = file.originalname.split('.').pop() || 'bin';
    const key = `uploads/${user.id}/${uuidv4()}.${ext}`;
    const url = await this.storageService.saveFile(key, file.buffer);
    return { url };
  }
}
