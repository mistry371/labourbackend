import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export enum StorageFolder {
  JOB_MEDIA = 'job-media',
  JOB_PROOF = 'job-proof',
  WORKER_DOCS = 'worker-docs',
  AVATARS = 'avatars',
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = config.get<string>('app.backendUrl') || 'http://localhost:3001';
    // Ensure upload directories exist
    Object.values(StorageFolder).forEach((folder) => {
      const dir = path.join(this.uploadDir, folder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  /**
   * Returns a pre-signed-style upload token.
   * Since we're using local disk, the frontend should POST the file
   * to /api/v1/storage/upload with the returned key as a form field.
   */
  async getSignedUploadUrl(
    folder: StorageFolder,
    fileType: string,
    userId: string,
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    const ext = fileType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const key = `${folder}/${userId}/${uuidv4()}.${ext}`;
    const uploadUrl = `${this.baseUrl}/api/v1/storage/upload`;
    const fileUrl = `${this.baseUrl}/uploads/${key}`;
    return { uploadUrl, fileUrl, key };
  }

  /**
   * Save a file buffer to disk.
   */
  async saveFile(key: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return `${this.baseUrl}/uploads/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.error(`Failed to delete file: ${key}`, err);
    }
  }

  /** For local storage, download URL is just the public URL */
  async getSignedDownloadUrl(key: string): Promise<string> {
    return `${this.baseUrl}/uploads/${key}`;
  }
}
