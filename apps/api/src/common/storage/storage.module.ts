import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LocalStorageDriver } from './local-storage.driver'
import { S3StorageDriver } from './s3-storage.driver'
import { STORAGE_DRIVER } from './storage-driver.interface'
import { StorageService } from './storage.service'

@Global()
@Module({
  providers: [
    LocalStorageDriver,
    S3StorageDriver,
    {
      provide: STORAGE_DRIVER,
      useFactory: (configService: ConfigService, local: LocalStorageDriver, s3: S3StorageDriver) =>
        configService.get<string>('storage.provider') === 's3' ? s3 : local,
      inject: [ConfigService, LocalStorageDriver, S3StorageDriver],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
