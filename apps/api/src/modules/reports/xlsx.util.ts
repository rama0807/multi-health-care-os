import { deflateRawSync } from 'node:zlib'

/**
 * A minimal, dependency-free `.xlsx` writer (Milestone 17 Checkpoint 17.3).
 *
 * An XLSX file is a ZIP of a handful of XML parts, and Node ships the only
 * hard part (DEFLATE) in `node:zlib` — so producing a genuine Excel workbook
 * costs ~150 lines here versus adding a large dependency to an API that
 * needs exactly one feature from it. The alternative frequently taken in
 * this situation — emitting CSV and naming it `.xlsx` — produces a file
 * Excel warns about on open, which is not "Excel export".
 *
 * Scope is deliberately narrow: one sheet, inline strings, a bold header
 * row, numeric cells written as real numbers so Excel can sum them. No
 * formulas, merged cells, or shared-string table.
 */

export interface XlsxColumn {
  key: string
  label: string
  /** Numeric columns are written as real numbers, so Excel can aggregate them. */
  numeric?: boolean
}

export type XlsxRow = Record<string, string | number | null | undefined>

const CRC_TABLE = buildCrcTable()

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// XML 1.0 forbids most control characters outright; they are stripped rather
// than emitted, since a single stray byte makes Excel refuse the whole file.
// Matching control characters is the entire point of this pattern, so
// `no-control-regex` is disabled deliberately rather than worked around.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(FORBIDDEN_XML_CHARS, '')
}

/** 0-based column index to spreadsheet letters: 0 -> A, 26 -> AA. */
function columnLetter(index: number): string {
  let letters = ''
  let n = index
  while (n >= 0) {
    letters = String.fromCharCode((n % 26) + 65) + letters
    n = Math.floor(n / 26) - 1
  }
  return letters
}

interface ZipEntry {
  name: string
  data: Buffer
}

/** DOS date/time, as the ZIP local header format requires. */
function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f)
  const dosDate = (((date.getFullYear() - 1980) & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, date: dosDate }
}

function buildZip(entries: ZipEntry[], now: Date): Buffer {
  const { time, date } = dosDateTime(now)
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8')
    const compressed = deflateRawSync(entry.data)
    const crc = crc32(entry.data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header signature
    local.writeUInt16LE(20, 4) // version needed to extract
    local.writeUInt16LE(0, 6) // general purpose flags
    local.writeUInt16LE(8, 8) // compression method: deflate
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28) // extra field length
    locals.push(local, nameBuffer, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central directory signature
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed to extract
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt16LE(0, 30) // extra field length
    central.writeUInt16LE(0, 32) // file comment length
    central.writeUInt16LE(0, 34) // disk number start
    central.writeUInt16LE(0, 36) // internal attributes
    central.writeUInt32LE(0, 38) // external attributes
    central.writeUInt32LE(offset, 42) // relative offset of local header
    centrals.push(central, nameBuffer)

    offset += local.length + nameBuffer.length + compressed.length
  }

  const centralBuffer = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory signature
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralBuffer, end])
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

/** Two cell styles: 0 = default, 1 = bold (the header row). */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
}

function cellXml(
  ref: string,
  value: string | number | null | undefined,
  numeric: boolean,
  styleId: number,
): string {
  const style = styleId ? ` s="${styleId}"` : ''
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${style}/>`

  if (numeric) {
    const parsed = typeof value === 'number' ? value : Number(value)
    // A "numeric" column can still carry a non-numeric marker (an em dash for
    // an undefined average). Falling back to text keeps the cell honest
    // rather than writing a silent 0.
    if (Number.isFinite(parsed)) return `<c r="${ref}"${style}><v>${parsed}</v></c>`
  }

  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

function sheetXml(columns: XlsxColumn[], rows: XlsxRow[]): string {
  const lines: string[] = []

  lines.push(
    `<row r="1">${columns
      .map((column, index) => cellXml(`${columnLetter(index)}1`, column.label, false, 1))
      .join('')}</row>`,
  )

  rows.forEach((row, rowIndex) => {
    const r = rowIndex + 2
    lines.push(
      `<row r="${r}">${columns
        .map((column, index) =>
          cellXml(`${columnLetter(index)}${r}`, row[column.key], column.numeric ?? false, 0),
        )
        .join('')}</row>`,
    )
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${lines.join('')}</sheetData>
</worksheet>`
}

/**
 * Builds a single-sheet `.xlsx` workbook. `sheetName` is truncated to Excel's
 * 31-character limit and stripped of the characters Excel rejects in a tab
 * name, since a caller-supplied report label reaches this directly.
 */
export function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxRow[], now = new Date()): Buffer {
  const safeSheetName = (sheetName.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Report').slice(0, 31)

  return buildZip(
    [
      { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
      { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
      { name: 'xl/workbook.xml', data: Buffer.from(workbookXml(safeSheetName), 'utf8') },
      { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(WORKBOOK_RELS, 'utf8') },
      { name: 'xl/styles.xml', data: Buffer.from(STYLES, 'utf8') },
      { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml(columns, rows), 'utf8') },
    ],
    now,
  )
}
