import { Option } from "effect"

// ---------------------------------------------------------------------------
// Set Code utilities — extraction and normalization
// ---------------------------------------------------------------------------

/** Normalize set codes for comparison: "OP-09" -> "OP09", "PRB-02" -> "PRB02" */
export const normalize = (code: string): string =>
  code.replace(/-/g, "")

/** Extract set prefix from idcard: "OP09-004" -> "OP09" */
export const extractFromIdCard = (idcard: string): Option.Option<string> => {
  const m = idcard.match(/^([A-Z]+\d+)-/)
  return m ? Option.some(m[1]) : Option.none()
}

/** Extract set code from cs field — bracket format "[OP-09]" or bare "OP-05" */
export const extractFromCs = (cs: string): Option.Option<string> => {
  const bracketMatch = cs.match(/\[([A-Z0-9-]+)\]/)
  if (bracketMatch) return Option.some(bracketMatch[1])
  const bare = cs.trim()
  if (/^[A-Z]+\d*-?\d+$/.test(bare)) return Option.some(bare)
  return Option.none()
}

/** Known extension prefixes for set filtering */
const EXTENSION_PREFIXES = ["OP", "EB", "ST", "PRB"] as const

export const isExtensionSet = (code: string): boolean =>
  EXTENSION_PREFIXES.some((p) => code.startsWith(p))
