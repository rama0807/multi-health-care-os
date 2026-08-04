import { UpdateRoomSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateRoomDto extends createZodDto(UpdateRoomSchema) {}
