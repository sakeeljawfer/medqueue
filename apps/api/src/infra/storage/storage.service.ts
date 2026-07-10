import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../../config/env';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface DetectedType {
  mime: string;
  ext: string;
}

/** Sniff the real content type from magic bytes — never trust the client MIME. */
export function detectImageType(buffer: Buffer): DetectedType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ENV) env: Env) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  /**
   * Validate (magic bytes + size) and store an image upload.
   * Returns the object key; objects are private and served via signed URLs.
   */
  async putImage(prefix: 'doctor-photos' | 'payment-slips', buffer: Buffer): Promise<string> {
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('file_too_large');
    const type = detectImageType(buffer);
    if (!type) throw new BadRequestException('unsupported_file_type');

    const key = `${prefix}/${randomUUID()}.${type.ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: type.mime,
      }),
    );
    return key;
  }

  /** Short-lived signed GET URL (default 10 minutes). */
  signedUrl(key: string, expiresInSeconds = 600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
