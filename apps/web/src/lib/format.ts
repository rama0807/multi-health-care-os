/** Tiny display helpers shared across the header, `/dashboard/profile` and `/dashboard/settings`. */

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

/** "ORG_ADMIN" → "Org Admin" */
export function humanizeRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}
