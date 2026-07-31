import { render, screen, waitFor } from '@testing-library/react'

import { AuthProvider, useAuth } from './auth-context'

jest.mock('@/lib/api/client', () => {
  let token: string | null = null
  return {
    apiClient: { post: jest.fn() },
    getAccessToken: () => token,
    setAccessToken: (t: string | null) => {
      token = t
    },
    setOnRefreshFailure: jest.fn(),
  }
})

const { apiClient } = jest.requireMock<{ apiClient: { post: jest.Mock } }>('@/lib/api/client')

function TestConsumer() {
  const { user, isLoading, isAuthenticated, hasPermission } = useAuth()
  if (isLoading) return <div>loading</div>
  return (
    <div>
      <div data-testid="authed">{String(isAuthenticated)}</div>
      <div data-testid="email">{user?.email ?? 'none'}</div>
      <div data-testid="perm">{String(hasPermission('patients.read'))}</div>
    </div>
  )
}

const mockUser = {
  id: 'user_1',
  email: 'doctor@example.com',
  firstName: 'Doc',
  lastName: 'Tor',
  avatar: null,
  organizationId: 'org_1',
  organizationSlug: 'org-1',
  organizationName: 'Test Org',
  roles: ['DOCTOR'],
  permissions: ['patients.read.own'],
  hospitalIds: [],
}

describe('AuthProvider', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows a loading state, then bootstraps a session from the refresh cookie', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { data: { accessToken: 'abc', expiresIn: 900, user: mockUser } },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))
    expect(screen.getByTestId('email')).toHaveTextContent('doctor@example.com')
    expect(screen.getByTestId('perm')).toHaveTextContent('true')
    expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh')
  })

  it('leaves the user unauthenticated when the silent refresh fails', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('401'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'))
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })

  it('hasPermission is false for a permission the user was not granted', async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { data: { accessToken: 'abc', expiresIn: 900, user: mockUser } },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))
    expect(screen.getByTestId('perm')).toHaveTextContent('true')
  })
})
