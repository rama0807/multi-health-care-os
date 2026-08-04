import { CreateRoomSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateRoomDto extends createZodDto(CreateRoomSchema) {}
