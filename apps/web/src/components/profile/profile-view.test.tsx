import { OrganizationType, UserStatus } from '@medicore/types'
import { render, screen } from '@testing-library/react'

import { ProfileView } from './profile-view'

const mockUser = {
  id: 'usr_dental_1',
  email: 'dentist@grovyn.com',
  firstName: 'Aarav',
  lastName: 'Sharma',
  avatar: null,
  roles: ['DENTAL_SURGEON', 'ORG_ADMIN'],
  permissions: ['dental_encounters.all', 'dental_odontogram.all'],
  organizationId: 'org_dental_1',
  organizationSlug: 'grovyn-dental',
  organizationName: 'Grovyn Dental Clinic',
  organizationType: OrganizationType.DENTAL,
  isPlatform: false,
  hospitalIds: [],
  status: UserStatus.ACTIVE,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
  }),
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/dental/profile',
  useRouter: () => ({ push: jest.fn() }),
}))

describe('ProfileView', () => {
  it('renders user identity, badges, and dental operating system details', () => {
    render(<ProfileView basePath="/dental" />)

    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument()
    expect(screen.getByText('dentist@grovyn.com')).toBeInTheDocument()
    expect(screen.getAllByText('Grovyn Dental Clinic')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Grovyn Dental OS')[0]).toBeInTheDocument()
    expect(screen.getByText('Dental Surgeon')).toBeInTheDocument()
    expect(screen.getByText('Org Admin')).toBeInTheDocument()
  })

  it('provides quick links configured for the active workspace basePath', () => {
    render(<ProfileView basePath="/dental" />)

    const notifPrefLink = screen.getByRole('link', { name: /Notification preferences/i })
    expect(notifPrefLink).toHaveAttribute('href', '/dental/notifications/preferences')

    const securityLink = screen.getByRole('link', { name: /Change password/i })
    expect(securityLink).toHaveAttribute('href', '/dental/settings?section=security')

    const sessionsLink = screen.getByRole('link', { name: /Active sessions/i })
    expect(sessionsLink).toHaveAttribute('href', '/dental/settings?section=sessions')
  })
})
