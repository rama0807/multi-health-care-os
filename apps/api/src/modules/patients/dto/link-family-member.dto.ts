import { LinkFamilyMemberSchema } from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class LinkFamilyMemberDto extends createZodDto(LinkFamilyMemberSchema) {}
