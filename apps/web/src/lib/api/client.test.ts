import { getAccessToken, setAccessToken } from './client'

describe('api client access token state', () => {
  afterEach(() => setAccessToken(null))

  it('starts with no access token', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('stores and returns the token that was set', () => {
    setAccessToken('token-123')
    expect(getAccessToken()).toBe('token-123')
  })

  it('clears the token when set to null', () => {
    setAccessToken('token-123')
    setAccessToken(null)
    expect(getAccessToken()).toBeNull()
  })
})
