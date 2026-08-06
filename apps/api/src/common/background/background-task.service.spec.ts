import { Logger } from '@nestjs/common'

import { BackgroundTaskService } from './background-task.service'

describe('BackgroundTaskService', () => {
  let metrics: { recordBackgroundRun: jest.Mock }
  let requestContext: { get: jest.Mock }
  let service: BackgroundTaskService
  let errorLog: jest.SpyInstance

  beforeEach(() => {
    metrics = { recordBackgroundRun: jest.fn() }
    requestContext = { get: jest.fn().mockReturnValue(undefined) }
    service = new BackgroundTaskService(metrics as never, requestContext as never)
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it('returns before the work finishes - that is the whole point', async () => {
    let finished = false
    service.run('job', async () => {
      await new Promise((resolve) => setImmediate(resolve))
      finished = true
    })

    expect(finished).toBe(false)
    await service.drain()
    expect(finished).toBe(true)
  })

  it('counts a successful run', async () => {
    service.run('auth.verification_email', () => Promise.resolve())
    await service.drain()

    expect(metrics.recordBackgroundRun).toHaveBeenCalledWith('auth.verification_email', 'success')
  })

  it('swallows a rejection so a caller that voids it cannot crash the process', async () => {
    service.run('auth.verification_email', () => Promise.reject(new Error('provider down')))

    await expect(service.drain()).resolves.toBeUndefined()
    expect(metrics.recordBackgroundRun).toHaveBeenCalledWith('auth.verification_email', 'failure')
  })

  it('logs a failure with the correlation ids of the request that scheduled it', async () => {
    requestContext.get.mockReturnValue({
      requestId: 'req-abc',
      trace: { traceId: 'trace-xyz', spanId: 'span-1' },
      method: 'POST',
      url: '/api/v1/auth/register',
    })

    service.run('auth.verification_email', () => Promise.reject(new Error('provider down')))
    await service.drain()

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('requestId=req-abc'),
      expect.anything(),
    )
    expect(errorLog.mock.calls[0][0]).toContain('traceId=trace-xyz')
    expect(errorLog.mock.calls[0][0]).toContain('provider down')
  })

  it('captures the context at schedule time, not at completion time', async () => {
    requestContext.get.mockReturnValue({
      requestId: 'req-during',
      trace: { traceId: 't', spanId: 's' },
      method: 'POST',
      url: '/x',
    })

    service.run('job', () => Promise.reject(new Error('boom')))
    // The request has ended by the time the task actually fails.
    requestContext.get.mockReturnValue(undefined)
    await service.drain()

    expect(errorLog.mock.calls[0][0]).toContain('requestId=req-during')
  })

  it('tracks in-flight work and clears it once drained', async () => {
    service.run('a', () => new Promise((resolve) => setImmediate(resolve)))
    service.run('b', () => new Promise((resolve) => setImmediate(resolve)))

    expect(service.pending).toBe(2)
    await service.drain()
    expect(service.pending).toBe(0)
  })

  it('drains cleanly when there is nothing in flight', async () => {
    await expect(service.drain()).resolves.toBeUndefined()
  })
})
