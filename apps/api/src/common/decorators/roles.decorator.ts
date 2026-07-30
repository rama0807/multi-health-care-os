import { SetMetadata } from '@nestjs/common'
import { SystemRole } from '@medicore/types'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles)

export const PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(PUBLIC_KEY, true)
