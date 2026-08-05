import { inflateRawSync } from 'node:zlib'

import { buildXlsx } from './xlsx.util'

/**
 * Reads one entry back out of the ZIP the writer produced, walking the
 * central directory the same way a real reader would — so these tests fail if
 * the container is malformed, not merely if the XML text is wrong.
 */
function readZipEntry(zip: Buffer, name: string): string {
  const endSignature = 0x06054b50
  let endOffset = zip.length - 22
  while (endOffset >= 0 && zip.readUInt32LE(endOffset) !== endSignature) endOffset--
  if (endOffset < 0) throw new Error('No end-of-central-directory record found')

  const entryCount = zip.readUInt16LE(endOffset + 10)
  let cursor = zip.readUInt32LE(endOffset + 16)

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Corrupt central directory header')
    const compressedSize = zip.readUInt32LE(cursor + 20)
    const nameLength = zip.readUInt16LE(cursor + 28)
    const extraLength = zip.readUInt16LE(cursor + 30)
    const commentLength = zip.readUInt16LE(cursor + 32)
    const localOffset = zip.readUInt32LE(cursor + 42)
    const entryName = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')

    if (entryName === name) {
      const localNameLength = zip.readUInt16LE(localOffset + 26)
      const localExtraLength = zip.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      return inflateRawSync(zip.subarray(dataStart, dataStart + compressedSize)).toString('utf8')
    }

    cursor += 46 + nameLength + extraLength + commentLength
  }

  throw new Error(`Entry "${name}" not found in archive`)
}

function listZipEntries(zip: Buffer): string[] {
  const endSignature = 0x06054b50
  let endOffset = zip.length - 22
  while (endOffset >= 0 && zip.readUInt32LE(endOffset) !== endSignature) endOffset--

  const entryCount = zip.readUInt16LE(endOffset + 10)
  let cursor = zip.readUInt32LE(endOffset + 16)
  const names: string[] = []

  for (let i = 0; i < entryCount; i++) {
    const nameLength = zip.readUInt16LE(cursor + 28)
    const extraLength = zip.readUInt16LE(cursor + 30)
    const commentLength = zip.readUInt16LE(cursor + 32)
    names.push(zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'))
    cursor += 46 + nameLength + extraLength + commentLength
  }

  return names
}

const COLUMNS = [
  { key: 'bucket', label: 'Period' },
  { key: 'invoiced', label: 'Invoiced', numeric: true },
  { key: 'note', label: 'Note' },
]

const NOW = new Date(2026, 7, 5, 10, 0, 0)

describe('buildXlsx', () => {
  it('produces an OOXML package with every part Excel requires', () => {
    const zip = buildXlsx('Report', COLUMNS, [], NOW)

    expect(listZipEntries(zip)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ])
  })

  it('starts with the ZIP local-file-header signature', () => {
    const zip = buildXlsx('Report', COLUMNS, [], NOW)

    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
  })

  it('writes a bold header row', () => {
    const sheet = readZipEntry(buildXlsx('Report', COLUMNS, [], NOW), 'xl/worksheets/sheet1.xml')

    // s="1" is the bold cell style declared in styles.xml.
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Period</t></is></c>')
  })

  it('writes numeric columns as real numbers so Excel can aggregate them', () => {
    const sheet = readZipEntry(
      buildXlsx('Report', COLUMNS, [{ bucket: '2026-08-01', invoiced: '1250.50', note: 'x' }], NOW),
      'xl/worksheets/sheet1.xml',
    )

    expect(sheet).toContain('<c r="B2"><v>1250.5</v></c>')
  })

  it('falls back to text when a numeric column carries a non-numeric marker', () => {
    // An em dash means "not measured"; writing it as 0 would be a lie.
    const sheet = readZipEntry(
      buildXlsx('Report', COLUMNS, [{ bucket: '2026-08-01', invoiced: '—', note: null }], NOW),
      'xl/worksheets/sheet1.xml',
    )

    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">—</t></is></c>')
  })

  it('emits an empty cell for null rather than the string "null"', () => {
    const sheet = readZipEntry(
      buildXlsx('Report', COLUMNS, [{ bucket: '2026-08-01', invoiced: '1', note: null }], NOW),
      'xl/worksheets/sheet1.xml',
    )

    expect(sheet).toContain('<c r="C2"/>')
    expect(sheet).not.toContain('null')
  })

  it('escapes XML metacharacters so the workbook still opens', () => {
    const sheet = readZipEntry(
      buildXlsx('Report', COLUMNS, [{ bucket: 'a', invoiced: '1', note: 'A & B <c> "d"' }], NOW),
      'xl/worksheets/sheet1.xml',
    )

    expect(sheet).toContain('A &amp; B &lt;c&gt; &quot;d&quot;')
  })

  it('strips control characters XML 1.0 forbids', () => {
    // Built at runtime rather than written as a literal, so the offending
    // byte never lands in this source file.
    const bell = String.fromCharCode(7)
    const sheet = readZipEntry(
      buildXlsx('Report', COLUMNS, [{ bucket: 'a', invoiced: '1', note: `bad${bell}value` }], NOW),
      'xl/worksheets/sheet1.xml',
    )

    expect(sheet).toContain('badvalue')
    expect(sheet).not.toContain(bell)
  })

  it('sanitises a sheet name Excel would reject and caps it at 31 characters', () => {
    const workbook = readZipEntry(
      buildXlsx('Revenue/Collections: [FY26] a name that is far too long', COLUMNS, [], NOW),
      'xl/workbook.xml',
    )

    const name = /name="([^"]*)"/.exec(workbook)?.[1] ?? ''
    expect(name.length).toBeLessThanOrEqual(31)
    expect(name).not.toMatch(/[\\/?*[\]:]/)
  })

  it('addresses columns past Z correctly', () => {
    const manyColumns = Array.from({ length: 28 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }))
    const sheet = readZipEntry(buildXlsx('Wide', manyColumns, [], NOW), 'xl/worksheets/sheet1.xml')

    expect(sheet).toContain('r="Z1"')
    expect(sheet).toContain('r="AA1"')
    expect(sheet).toContain('r="AB1"')
  })
})
