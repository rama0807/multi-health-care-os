import { CreateDrugReturnSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class CreateDrugReturnDto extends createZodDto(CreateDrugReturnSchema) {}
