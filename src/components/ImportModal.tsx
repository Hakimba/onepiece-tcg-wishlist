import { useState, useRef, useCallback } from "react"
import type { Card } from "../domain/Card"
import type { VariantsIndex } from "../services/VariantResolver"
import type { SetLists } from "../domain/SetIndex"
import SerieBrowser from "./SerieBrowser"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void
  onImportCsv: (file: File) => void
  onImportBySerie: (cards: ReadonlyArray<Card>) => void
  variantsIndex: VariantsIndex
  setLists: SetLists
  existingCards: ReadonlyArray<Card>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = "picker" | "browse"

export default function ImportModal({
  onClose,
  onImportCsv,
  onImportBySerie,
  variantsIndex,
  setLists,
  existingCards,
}: Props) {
  const [step, setStep] = useState<Step>("picker")
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCsvClick = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onImportCsv(file)
        onClose()
      }
      e.target.value = ""
    },
    [onImportCsv, onClose],
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (step === "browse") {
    return (
      <SerieBrowser
        variantsIndex={variantsIndex}
        setLists={setLists}
        existingCards={existingCards}
        onConfirm={onImportBySerie}
        onBack={() => setStep("picker")}
      />
    )
  }

  return (
    <div className="import-modal-overlay" onClick={handleBackdropClick}>
      <div className="import-modal-panel">
        <div className="import-modal-title">Importer des cartes</div>

        <button className="import-modal-btn" onClick={handleCsvClick} type="button">
          <span className="import-modal-btn-icon">📄</span>
          <span className="import-modal-btn-text">
            <span className="import-modal-btn-label">Import CSV</span>
            <span className="import-modal-btn-desc">Depuis un fichier CSV</span>
          </span>
        </button>

        <button className="import-modal-btn" onClick={() => setStep("browse")} type="button">
          <span className="import-modal-btn-icon">🗂️</span>
          <span className="import-modal-btn-text">
            <span className="import-modal-btn-label">Import par série</span>
            <span className="import-modal-btn-desc">Parcourir les extensions et sélectionner</span>
          </span>
        </button>

        <button className="import-modal-close" onClick={onClose} type="button">
          Annuler
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    </div>
  )
}
