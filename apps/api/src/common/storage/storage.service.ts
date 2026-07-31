import { Inject, Injectable } from '@nestjs/common'

import { STORAGE_DRIVER, StorageDriver, UploadInput } from './storage-driver.interface'

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  upload(input: UploadInput): Promise<string> {
    return this.driver.upload(input)
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key)
  }
}
