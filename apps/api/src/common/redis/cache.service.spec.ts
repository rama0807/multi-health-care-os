import { CacheService } from './cache.service'

describe('CacheService', () => {
  let store: Map<string, string>
  let redis: {
    get: jest.Mock
    set: jest.Mock
    del: jest.Mock
    getClient: jest.Mock
  }
  let scan: jest.Mock
  let clientDel: jest.Mock
  let cache: CacheService

  beforeEach(() => {
    store = new Map()
    scan = jest.fn()
    clientDel = jest.fn((...keys: string[]) => {
      keys.forEach((key) => store.delete(key))
      return Promise.resolve(keys.length)
    })
    redis = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      set: jest.fn((key: string, value: string) => Promise.resolve(void store.set(key, value))),
      del: jest.fn((...keys: string[]) => Promise.resolve(keys.forEach((key) => store.delete(key)))),
      getClient: jest.fn(() => ({ scan, del: clientDel })),
    }
    cache = new CacheService(redis as never)
  })

  describe('key', () => {
    it('always scopes to a tenant', () => {
      expect(cache.key('org_1', 'templates')).toBe('medicore:cache:org_1:templates')
      expect(cache.key('org_1', 'templates', 'APPOINTMENT')).toBe(
        'medicore:cache:org_1:templates:APPOINTMENT',
      )
    })

    it('refuses to build a key with no organization, rather than sharing one across tenants', () => {
      expect(() => cache.key('', 'templates')).toThrow(/tenant-scoped/)
    })
  })

  describe('wrap', () => {
    it('calls the loader once and serves the cached value afterwards', async () => {
      const loader = jest.fn().mockResolvedValue({ name: 'Booked' })

      await expect(cache.wrap('k', 60, loader)).resolves.toEqual({ name: 'Booked' })
      await expect(cache.wrap('k', 60, loader)).resolves.toEqual({ name: 'Booked' })

      expect(loader).toHaveBeenCalledTimes(1)
    })

    it('caches an absent result too, so a miss is not re-queried on every request', async () => {
      const loader = jest.fn().mockResolvedValue(undefined)

      await expect(cache.wrap('k', 60, loader)).resolves.toBeUndefined()
      await expect(cache.wrap('k', 60, loader)).resolves.toBeUndefined()

      expect(loader).toHaveBeenCalledTimes(1)
    })

    it('passes the TTL through, so nothing is cached indefinitely', async () => {
      await cache.wrap('k', 120, () => Promise.resolve('v'))
      expect(redis.set).toHaveBeenCalledWith('k', expect.any(String), 120)
    })

    it('falls back to the loader when Redis is down — a cache must not fail a request', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'))
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(cache.wrap('k', 60, () => Promise.resolve('live value'))).resolves.toBe('live value')
    })

    it('reloads rather than throwing when a stored value no longer parses', async () => {
      store.set('k', '{ this is not json')

      await expect(cache.wrap('k', 60, () => Promise.resolve('reloaded'))).resolves.toBe('reloaded')
    })
  })

  describe('invalidatePrefix', () => {
    it('walks the keyspace with SCAN and deletes every match', async () => {
      // Two pages, to prove the cursor is followed rather than read once.
      scan
        .mockResolvedValueOnce(['17', ['medicore:cache:org_1:templates:A']])
        .mockResolvedValueOnce(['0', ['medicore:cache:org_1:templates:B']])

      await expect(cache.invalidatePrefix('medicore:cache:org_1:templates')).resolves.toBe(2)

      expect(scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'medicore:cache:org_1:templates*',
        'COUNT',
        200,
      )
      expect(scan).toHaveBeenNthCalledWith(2, '17', expect.anything(), expect.anything(), expect.anything(), expect.anything())
      expect(clientDel).toHaveBeenCalledTimes(2)
    })

    it('does not call DEL on an empty page', async () => {
      scan.mockResolvedValueOnce(['0', []])

      await expect(cache.invalidatePrefix('medicore:cache:org_1:x')).resolves.toBe(0)
      expect(clientDel).not.toHaveBeenCalled()
    })

    it('reports zero rather than throwing when Redis is unavailable', async () => {
      scan.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(cache.invalidatePrefix('medicore:cache:org_1:x')).resolves.toBe(0)
    })
  })
})
