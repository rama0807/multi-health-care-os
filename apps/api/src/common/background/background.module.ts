import { Global, Module } from '@nestjs/common'

import { BackgroundTaskService } from './background-task.service'

/**
 * Global, like `ObservabilityModule` and `RedisModule`: "do this off the
 * request path" is a cross-cutting concern, and every module that sends an
 * email would otherwise have to import it (Milestone 19.3).
 */
@Global()
@Module({
  providers: [BackgroundTaskService],
  exports: [BackgroundTaskService],
})
export class BackgroundModule {}
