/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable import/order */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { apiClient, setAccessToken } from '@/lib/api/client'
import { RegisterForm } from './register-form'

const mockPush = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ data: { message: 'Success' } }),
  },
  setAccessToken: jest.fn(),
}))

describe('RegisterForm - Dual-Product Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('defaults to Hospital OS when no type param is supplied', () => {
    render(<RegisterForm />)

    expect(screen.getByText('Hospital OS')).toBeInTheDocument()
    expect(screen.getByText('Dental OS')).toBeInTheDocument()
    expect(screen.getByText(/Set up your facility on Grovyn Hospital OS/i)).toBeInTheDocument()
  })

  it('preselects Dental OS when ?type=DENTAL is provided', () => {
    mockSearchParams = new URLSearchParams('type=DENTAL')
    render(<RegisterForm />)

    expect(screen.getByText(/Set up your practice on Grovyn Dental OS/i)).toBeInTheDocument()
  })

  it('allows the user to toggle between Hospital OS and Dental OS with one click', () => {
    render(<RegisterForm />)

    const dentalButton = screen.getByRole('button', { name: /Dental OS/i })
    fireEvent.click(dentalButton)

    expect(screen.getByText(/Set up your practice on Grovyn Dental OS/i)).toBeInTheDocument()

    const hospitalButton = screen.getByRole('button', { name: /Hospital OS/i })
    fireEvent.click(hospitalButton)

    expect(screen.getByText(/Set up your facility on Grovyn Hospital OS/i)).toBeInTheDocument()
  })

  it('displays a success info screen after account creation and allows navigation to login', async () => {
    render(<RegisterForm />)

    fireEvent.change(screen.getByLabelText(/Organization Name/i), { target: { value: 'City Clinic' } })
    fireEvent.change(screen.getByLabelText(/Organization Slug/i), { target: { value: 'city-clinic' } })
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'jane@cityclinic.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123' } })
    fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '9876543210' } })

    const submitButton = screen.getByRole('button', { name: /Create Organization/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/register?autoLogin=false',
        expect.objectContaining({
          organizationName: 'City Clinic',
          adminEmail: 'jane@cityclinic.com',
        }),
      )
    })

    expect(setAccessToken).toHaveBeenCalledWith(null)

    await waitFor(() => {
      expect(screen.getByText('Account Created Successfully!')).toBeInTheDocument()
      expect(screen.getByText(/City Clinic/i)).toBeInTheDocument()
      expect(screen.getByText(/jane@cityclinic.com/i)).toBeInTheDocument()
      expect(screen.getByText(/Redirecting to sign-in page in/i)).toBeInTheDocument()
    })

    const signInButton = screen.getByRole('button', { name: /Sign In Now/i })
    fireEvent.click(signInButton)

    expect(mockPush).toHaveBeenCalledWith('/login?registered=true')
  })
})
