export const REQUESTED_BY_NAME_MAX_LENGTH = 64

/** Trimmed operator name, or `null` if empty or too long. */
export function readOperatorName(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === '' || trimmed.length > REQUESTED_BY_NAME_MAX_LENGTH) {
    return null
  }

  return trimmed
}
