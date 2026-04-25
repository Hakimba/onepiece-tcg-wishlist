import { Either, Option, Data } from "effect"
import type { Card } from "../domain/Card"
import { makeCard } from "../domain/Card"
import { parseRarityOrUnknown, displayRarity } from "../domain/Rarity"
import { parsePrice, displayPrice } from "../domain/Price"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type CsvError = Data.TaggedEnum<{
  EmptyFile: {}
  MissingColumn: { readonly column: string }
}>

export const CsvError = Data.taggedEnum<CsvError>()
export const { EmptyFile, MissingColumn } = CsvError

// ---------------------------------------------------------------------------
// CSV line parser (pure state machine — kept imperative, it's correct)
// ---------------------------------------------------------------------------

export const parseCsvLine = (line: string): ReadonlyArray<string> => {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        fields.push(current.trim())
        current = ""
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

// ---------------------------------------------------------------------------
// CSV field escaping (pure)
// ---------------------------------------------------------------------------

const escapeField = (field: string): string =>
  field.includes(",") || field.includes('"') || field.includes("\n")
    ? `"${field.replace(/"/g, '""')}"`
    : field

// ---------------------------------------------------------------------------
// Parse CSV text -> Either<CsvError, ReadonlyArray<Card>>
// ---------------------------------------------------------------------------

export const parseCsv = (text: string): Either.Either<ReadonlyArray<Card>, CsvError> => {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return Either.left(EmptyFile())

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())

  const col = (name: string): number => header.indexOf(name)
  const idcardIdx = col("idcard")
  const serieIdx = col("serie")
  const characterIdx = col("character")
  const rarityIdx = col("rarity")
  const priceIdx = col("price")
  const sellerUrlIdx = col("seller_url")
  const favoriteIdx = col("favorite")
  const editionIdx = col("edition")
  const imageSuffixIdx = col("image_suffix")

  if (idcardIdx < 0) return Either.left(MissingColumn({ column: "idcard" }))

  const cards: Card[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === "") continue
    const cols = parseCsvLine(line)

    const idcard = cols[idcardIdx] ?? ""
    const serie = serieIdx >= 0 ? cols[serieIdx] ?? "" : ""
    const character = characterIdx >= 0 ? cols[characterIdx] ?? "" : ""
    const rarityRaw = rarityIdx >= 0 ? cols[rarityIdx] ?? "" : ""
    const priceRaw = priceIdx >= 0 ? cols[priceIdx] ?? "" : ""
    const sellerUrl = sellerUrlIdx >= 0 ? cols[sellerUrlIdx] ?? "" : ""
    const fav = favoriteIdx >= 0 ? cols[favoriteIdx] ?? "" : ""
    const edition = editionIdx >= 0 ? cols[editionIdx] ?? "" : ""
    const imgSuffix = imageSuffixIdx >= 0 ? cols[imageSuffixIdx] ?? "" : ""

    cards.push(
      makeCard({
        idcard,
        serie,
        character,
        rarity: parseRarityOrUnknown(rarityRaw),
        price: parsePrice(priceRaw),
        buyLink: sellerUrl || undefined,
        favorite: fav === "1",
        edition: edition || undefined,
        imageSuffix: imgSuffix || undefined,
      }),
    )
  }

  return Either.right(cards)
}

// ---------------------------------------------------------------------------
// Export CSV : ReadonlyArray<Card> -> string (pure)
// ---------------------------------------------------------------------------

export const exportCsv = (cards: ReadonlyArray<Card>): string => {
  const header = "serie,idcard,character,rarity,price,seller_url,favorite,edition,image_suffix"
  const rows = cards.map((c) =>
    [
      c.serie,
      c.idcard,
      c.character,
      displayRarity(c.rarity),
      displayPrice(c.price),
      Option.getOrElse(c.buyLink, () => ""),
      c.favorite ? "1" : "",
      Option.getOrElse(c.edition, () => ""),
      Option.getOrElse(c.imageSuffix, () => ""),
    ]
      .map(escapeField)
      .join(","),
  )
  return [header, ...rows].join("\n") + "\n"
}

// ---------------------------------------------------------------------------
// Download CSV — the ONLY impure function (DOM side effect), isolated
// ---------------------------------------------------------------------------

const isIOSStandalone = (): boolean =>
  (navigator as any).standalone === true ||
  ((/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    window.matchMedia("(display-mode: standalone)").matches)

const downloadViaOpen = (csv: string): boolean => {
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url)
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  }
  URL.revokeObjectURL(url)
  return false
}

const downloadViaLink = (csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "onepiece-wishlist.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const shareFile = async (csv: string): Promise<boolean> => {
  const file = new File([csv], "onepiece-wishlist.csv", { type: "text/csv" })
  if (!navigator.canShare?.({ files: [file] })) return false
  try { await navigator.share({ files: [file] }); return true } catch { return false }
}

const copyToClipboard = async (csv: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(csv); return true } catch { return false }
}

export type ExportResult = "ok" | "clipboard" | "fail"

export const downloadCsv = async (cards: ReadonlyArray<Card>): Promise<ExportResult> => {
  const csv = exportCsv(cards)

  if (isIOSStandalone()) {
    if (downloadViaOpen(csv)) return "ok"
    if (navigator.share && await shareFile(csv)) return "ok"
    if (await copyToClipboard(csv)) return "clipboard"
    return "fail"
  }

  if (navigator.share && await shareFile(csv)) return "ok"
  downloadViaLink(csv)
  return "ok"
}
