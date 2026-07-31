export interface UploadInput {
  key: string
  buffer: Buffer
  mimeType: string
}

/**
 * Storage is swappable behind this interface — domain modules depend only on
 * `StorageService`, never on a concrete driver, so moving from local disk to
 * S3/MinIO (or between them) is a config change, not a code change.
 */
export interface StorageDriver {
  upload(input: UploadInput): Promise<string>
  delete(key: string): Promise<void>
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER')
