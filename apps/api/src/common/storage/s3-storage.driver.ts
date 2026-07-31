import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { StorageDriver, UploadInput } from './storage-driver.interface'

@Injectable()
export class S3StorageDriver implements StorageDriver {
  private client: S3Client | null = null

  constructor(private readonly configService: ConfigService) {}

  async upload({ key, buffer, mimeType }: UploadInput): Promise<string> {
    await this.getClient().send(
      new PutObjectCommand({ Bucket: this.bucket(), Key: key, Body: buffer, ContentType: mimeType }),
    )
    const publicUrl = this.configService.get<string>('storage.s3.publicUrl')
    return publicUrl ? `${publicUrl}/${key}` : key
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }))
  }

  private bucket(): string {
    const bucket = this.configService.get<string>('storage.s3.bucket')
    if (!bucket) throw new Error('S3 storage provider selected but S3_BUCKET is not configured')
    return bucket
  }

  // Constructed lazily (not in the constructor) so that selecting the local
  // driver in an environment without S3 credentials never fails app bootstrap
  // — this driver is only exercised, and only then validated, if it's chosen.
  private getClient(): S3Client {
    if (this.client) return this.client

    const accessKeyId = this.configService.get<string>('storage.s3.accessKeyId')
    const secretAccessKey = this.configService.get<string>('storage.s3.secretAccessKey')
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 storage provider selected but S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are not configured',
      )
    }

    this.client = new S3Client({
      region: this.configService.get<string>('storage.s3.region', 'us-east-1'),
      endpoint: this.configService.get<string>('storage.s3.endpoint'),
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
    return this.client
  }
}
