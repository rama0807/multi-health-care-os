import { registerAs } from '@nestjs/config'

export default registerAs('storage', () => ({
  provider: process.env.STORAGE_PROVIDER === 's3' || process.env.STORAGE_PROVIDER === 'minio' ? 's3' : 'local',
  local: {
    basePath: process.env.LOCAL_STORAGE_PATH ?? './uploads',
    publicUrl:
      process.env.LOCAL_STORAGE_PUBLIC_URL ?? `${process.env.APP_URL ?? 'http://localhost:4000'}/uploads`,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicUrl: process.env.S3_PUBLIC_URL,
  },
}))
