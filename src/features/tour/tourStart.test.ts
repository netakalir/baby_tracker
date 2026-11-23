import { afterEach, describe, expect, it } from 'vitest'
import { clearTourRequest, isTourRequested, requestTourOnArrival } from './tourStart'

describe('tour start request', () => {
  afterEach(() => clearTourRequest())

  it('is off until requested', () => {
    expect(isTourRequested()).toBe(false)
  })

  it('stays raised across reads until cleared', () => {
    requestTourOnArrival()
    expect(isTourRequested()).toBe(true)
    expect(isTourRequested()).toBe(true)

    clearTourRequest()
    expect(isTourRequested()).toBe(false)
  })
})
