import { JwtPayload } from '@medicore/types'
import { Injectable } from '@nestjs/common'


export type PermissionScope = 'all' | 'own' | null

@Injectable()
export class PermissionsService {
  /**
   * Resolves the effective scope a caller holds for a given "resource.action"
   * pair. Guards only prove *some* access exists - services call this to
   * decide whether an ownership filter (e.g. `WHERE doctorId = user.sub`)
   * must be added to the underlying query. `.all` always wins over `.own`
   * when a caller somehow holds both.
   */
  getScope(payload: JwtPayload, resource: string, action: string): PermissionScope {
    const granted = new Set(payload.permissions ?? [])
    if (granted.has(`${resource}.${action}.all`)) return 'all'
    if (granted.has(`${resource}.${action}.own`)) return 'own'
    return null
  }

  has(payload: JwtPayload, resource: string, action: string): boolean {
    return this.getScope(payload, resource, action) !== null
  }
}
