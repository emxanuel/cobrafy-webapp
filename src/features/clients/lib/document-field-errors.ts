/** Maps CBF-215 `guarantors.<i>.document` onto the matching contact row. */
const GUARANTOR_DOCUMENT_FIELD = /^guarantors\.(\d+)\.document$/

export function formFieldFromApiField(
  apiField: string,
  contacts: Array<{ type?: string }>,
): string {
  const match = GUARANTOR_DOCUMENT_FIELD.exec(apiField)
  if (!match) return apiField
  const guarantorIndex = parseInt(match[1], 10)
  let seen = 0
  for (let index = 0; index < contacts.length; index += 1) {
    if (contacts[index]?.type !== 'garante') continue
    if (seen === guarantorIndex) return `contacts.${index}.document`
    seen += 1
  }
  return `contacts.${guarantorIndex}.document`
}

export function mapApiFieldErrors(
  fieldErrors: Record<string, string>,
  contacts: Array<{ type?: string }>,
): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [field, message] of Object.entries(fieldErrors)) {
    const name = formFieldFromApiField(field, contacts)
    if (!mapped[name]) mapped[name] = message
  }
  return mapped
}
