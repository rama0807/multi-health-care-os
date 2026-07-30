import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'

@ApiTags('inventory')
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}
}
