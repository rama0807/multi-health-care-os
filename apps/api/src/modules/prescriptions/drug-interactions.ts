import { DrugInteractionWarning } from '@medicore/types'

/**
 * Bundled, non-exhaustive seed list of well-known interaction pairs — not a
 * connection to a real drug-interaction terminology service (none is
 * configured anywhere in this repo). Matching is on generic/common name
 * substrings, case-insensitive. This is a basic advisory check, not a
 * clinical decision system: it never blocks prescribing, and the frontend
 * must present warnings as "basic, non-exhaustive" rather than complete.
 */
const KNOWN_INTERACTIONS: Array<{ a: string; b: string; severity: 'moderate' | 'severe'; description: string }> = [
  {
    a: 'warfarin',
    b: 'aspirin',
    severity: 'severe',
    description: 'Combined use significantly increases bleeding risk.',
  },
  {
    a: 'warfarin',
    b: 'ibuprofen',
    severity: 'severe',
    description: 'NSAIDs increase bleeding risk and can reduce warfarin clearance.',
  },
  {
    a: 'aspirin',
    b: 'ibuprofen',
    severity: 'moderate',
    description: 'Ibuprofen may reduce the cardioprotective antiplatelet effect of aspirin.',
  },
  {
    a: 'methotrexate',
    b: 'ibuprofen',
    severity: 'severe',
    description: 'NSAIDs can reduce methotrexate clearance, raising toxicity risk.',
  },
  {
    a: 'sildenafil',
    b: 'nitroglycerin',
    severity: 'severe',
    description: 'Combined use can cause a severe, potentially fatal drop in blood pressure.',
  },
  {
    a: 'metformin',
    b: 'contrast',
    severity: 'moderate',
    description: 'Iodinated contrast media can increase the risk of lactic acidosis with metformin.',
  },
  {
    a: 'simvastatin',
    b: 'clarithromycin',
    severity: 'severe',
    description: 'Strong CYP3A4 inhibition raises simvastatin levels and myopathy/rhabdomyolysis risk.',
  },
  {
    a: 'lisinopril',
    b: 'spironolactone',
    severity: 'moderate',
    description: 'Combined use increases the risk of hyperkalemia.',
  },
  {
    a: 'fluoxetine',
    b: 'tramadol',
    severity: 'severe',
    description: 'Combined serotonergic activity increases the risk of serotonin syndrome.',
  },
  {
    a: 'digoxin',
    b: 'amiodarone',
    severity: 'severe',
    description: 'Amiodarone raises digoxin levels, increasing the risk of digoxin toxicity.',
  },
]

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Checks every unordered pair across `medicationNames` (case-insensitive
 * substring match against generic names) and returns any known interaction
 * warnings. Pass the union of a new prescription's items and the patient's
 * other currently-ACTIVE prescriptions' items to also catch cross-prescription
 * interactions, not just within-prescription ones.
 */
export function checkDrugInteractions(medicationNames: string[]): DrugInteractionWarning[] {
  const normalized = medicationNames.map((name) => ({ original: name, normalized: normalize(name) }))
  const warnings: DrugInteractionWarning[] = []
  const seen = new Set<string>()

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const left = normalized[i]
      const right = normalized[j]
      if (left.normalized === right.normalized) continue

      for (const pair of KNOWN_INTERACTIONS) {
        const matchesForward = left.normalized.includes(pair.a) && right.normalized.includes(pair.b)
        const matchesBackward = left.normalized.includes(pair.b) && right.normalized.includes(pair.a)
        if (!matchesForward && !matchesBackward) continue

        const key = [left.original, right.original, pair.description].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)

        warnings.push({
          medicationA: left.original,
          medicationB: right.original,
          severity: pair.severity,
          description: pair.description,
        })
      }
    }
  }

  return warnings
}
