import { parseCsv } from './csv-parser.util'

describe('parseCsv', () => {
  it('parses a simple comma-separated file', () => {
    const rows = parseCsv('firstName,lastName\nAsha,Rao\nVikram,Nair\n')
    expect(rows).toEqual([
      ['firstName', 'lastName'],
      ['Asha', 'Rao'],
      ['Vikram', 'Nair'],
    ])
  })

  it('handles quoted fields containing commas and escaped quotes', () => {
    const rows = parseCsv('name,address\n"Rao, Asha","123 ""Main"" St"\n')
    expect(rows).toEqual([
      ['name', 'address'],
      ['Rao, Asha', '123 "Main" St'],
    ])
  })

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('drops blank trailing lines', () => {
    const rows = parseCsv('a,b\n1,2\n\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles a file with no trailing newline', () => {
    const rows = parseCsv('a,b\n1,2')
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})
