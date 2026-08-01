import { checkDrugInteractions } from './drug-interactions'

describe('checkDrugInteractions', () => {
  it('returns no warnings for unrelated medications', () => {
    expect(checkDrugInteractions(['Paracetamol', 'Cetirizine'])).toEqual([])
  })

  it('flags a known severe interaction pair', () => {
    const warnings = checkDrugInteractions(['Warfarin', 'Aspirin'])

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ medicationA: 'Warfarin', medicationB: 'Aspirin', severity: 'severe' })
  })

  it('matches case-insensitively', () => {
    expect(checkDrugInteractions(['warfarin', 'ASPIRIN'])).toHaveLength(1)
  })

  it('matches regardless of pair order', () => {
    expect(checkDrugInteractions(['Aspirin', 'Warfarin'])).toHaveLength(1)
  })

  it('does not flag the same medication listed twice', () => {
    expect(checkDrugInteractions(['Aspirin', 'Aspirin'])).toEqual([])
  })

  it('reports one warning per distinct pair of medications, even when both mention the same drug', () => {
    const warnings = checkDrugInteractions(['Warfarin', 'Aspirin', 'Warfarin 5mg'])
    expect(warnings).toHaveLength(2)
    expect(new Set(warnings.map((w) => `${w.medicationA}|${w.medicationB}`)).size).toBe(2)
  })

  it('can surface multiple distinct interaction pairs at once', () => {
    const warnings = checkDrugInteractions(['Warfarin', 'Aspirin', 'Ibuprofen'])
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('returns no warnings for a single medication', () => {
    expect(checkDrugInteractions(['Paracetamol'])).toEqual([])
  })
})
