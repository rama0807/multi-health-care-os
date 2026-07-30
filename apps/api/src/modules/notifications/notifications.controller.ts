import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { NotificationsService } from './notifications.service'

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
}
