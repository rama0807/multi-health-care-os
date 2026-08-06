/**
 * Literal `{{name}}` substitution - deliberately not a template engine, so a
 * stored prompt can never execute code or reach outside the values passed in
 * (ADR-0023). Placeholders with no supplied value collapse to an empty string
 * rather than leaking the raw `{{name}}` marker into the prompt.
 */
export function renderPromptTemplate(template: string, values: Record<string, string | undefined>): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
