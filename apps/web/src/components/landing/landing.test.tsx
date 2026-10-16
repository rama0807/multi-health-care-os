import { render, screen } from '@testing-library/react'

import { LandingFooter } from './landing-footer'
import { LandingNav } from './landing-nav'

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    hasPermission: jest.fn(),
  }),
}))

describe('Grovyn Landing Components', () => {
  it('renders LandingNav with brand name and key navigation links', () => {
    render(<LandingNav />)

    expect(screen.getByText('Grovyn')).toBeInTheDocument()
    expect(screen.getByText('Healthcare OS')).toBeInTheDocument()
    expect(screen.getByText('Log In')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('renders LandingFooter with copyright and product links', () => {
    render(<LandingFooter />)

    expect(screen.getAllByText(/Grovyn Hospital OS/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Grovyn Dental OS/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Grovyn Healthcare Systems/i)).toBeInTheDocument()
  })
})
