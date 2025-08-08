import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import sharp from 'sharp';

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle?: boolean;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
  optimizeImage?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface FileInfo {
  key: string;
  size: number;
  contentType?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export class StorageManager {
  private s3Client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;

    this.s3Client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle || false,
    });
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<{ key: string; url?: string }> {
    try {
      let processedBuffer = buffer;

      // Optimize image if requested
      if (options.optimizeImage && this.isImageFile(options.contentType)) {
        processedBuffer = await this.optimizeImage(buffer, {
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          quality: options.quality,
        });
      }

      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processedBuffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
        ACL: options.isPublic ? 'public-read' : 'private',
      });

      await this.s3Client.send(putCommand);

      logger.info('File uploaded successfully', {
        key,
        size: processedBuffer.length,
        contentType: options.contentType,
      });

      // Return public URL if public
      const url = options.isPublic
        ? `https://${this.bucket}.s3.amazonaws.com/${key}`
        : undefined;

      return { key, url };
    } catch (error) {
      logger.error('File upload failed', { key, error });
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Upload file from stream (useful for large files)
   */
  async uploadStream(
    key: string,
    stream: any, // Using any to avoid complex Node.js stream types
    options: UploadOptions = {}
  ): Promise<{ key: string; url?: string }> {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: options.contentType,
        Metadata: options.metadata,
        ACL: options.isPublic ? 'public-read' : 'private',
      });

      await this.s3Client.send(putCommand);

      logger.info('Stream uploaded successfully', { key });

      const url = options.isPublic
        ? `https://${this.bucket}.s3.amazonaws.com/${key}`
        : undefined;

      return { key, url };
    } catch (error) {
      logger.error('Stream upload failed', { key, error });
      throw new Error(`Failed to upload stream: ${error}`);
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(getCommand);
      
      if (!response.Body) {
        throw new Error('File not found or empty');
      }

      const chunks: Buffer[] = [];
      const stream = response.Body as any; // Use any to avoid complex stream typing

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      logger.error('File download failed', { key, error });
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Get a presigned URL for direct upload or download
   */
  async getPresignedUrl(
    key: string,
    operation: 'get' | 'put' = 'get',
    expiresIn = 3600
  ): Promise<string> {
    try {
      const command = operation === 'get' 
        ? new GetObjectCommand({ Bucket: this.bucket, Key: key })
        : new PutObjectCommand({ Bucket: this.bucket, Key: key });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('Presigned URL generated', { key, operation, expiresIn });
      return url;
    } catch (error) {
      logger.error('Presigned URL generation failed', { key, operation, error });
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(deleteCommand);
      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('File deletion failed', { key, error });
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(key: string): Promise<FileInfo | null> {
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(headCommand);

      return {
        key,
        size: response.ContentLength || 0,
        contentType: response.ContentType,
        lastModified: response.LastModified || new Date(),
        metadata: response.Metadata,
      };
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        return null;
      }
      logger.error('Get file info failed', { key, error });
      throw new Error(`Failed to get file info: ${error}`);
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(prefix?: string, maxKeys = 1000): Promise<FileInfo[]> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(listCommand);
      
      return (response.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    } catch (error) {
      logger.error('List files failed', { prefix, error });
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const info = await this.getFileInfo(key);
    return info !== null;
  }

  /**
   * Optimize image using Sharp
   */
  private async optimizeImage(
    buffer: Buffer,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
    }
  ): Promise<Buffer> {
    let image = sharp(buffer);

    // Resize if dimensions are specified
    if (options.maxWidth || options.maxHeight) {
      image = image.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply quality settings
    if (options.quality) {
      image = image.jpeg({ quality: options.quality });
    }

    return await image.toBuffer();
  }

  /**
   * Check if file is an image based on content type
   */
  private isImageFile(contentType?: string): boolean {
    if (!contentType) return false;
    return contentType.startsWith('image/');
  }
}

// Factory function to create storage manager based on environment
export function createStorageManager(): StorageManager {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Use MinIO for local development
    return new StorageManager({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'codeguide',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'codeguide123',
      bucket: process.env.MINIO_BUCKET_NAME || 'codeguide-local',
      forcePathStyle: true,
    });
  } else {
    // Use AWS S3 for production
    return new StorageManager({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      bucket: process.env.AWS_S3_BUCKET_NAME!,
    });
  }
}

export const storageManager = createStorageManager();