import { mkdir, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { StorageDriver, UploadInput } from './storage-driver.interface'

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly configService: ConfigService) {}

  async upload({ key, buffer }: UploadInput): Promise<string> {
    const filePath = join(this.basePath(), key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, buffer)
    return `${this.publicUrl()}/${key}`
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath(), key)
    try {
      await unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private basePath(): string {
    return this.configService.get<string>('storage.local.basePath', './uploads')
  }

  private publicUrl(): string {
    return this.configService.get<string>('storage.local.publicUrl', 'http://localhost:4000/uploads')
  }
}
