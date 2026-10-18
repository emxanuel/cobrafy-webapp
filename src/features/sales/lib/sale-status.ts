export function isSaleVoided(status: string): boolean {
  return status === 'anulada' || status === 'voided'
}

export function purchaseCounterLabel(items: Array<{ status: string }>): string {
  let active = 0
  let voided = 0
  for (const item of items) {
    if (isSaleVoided(item.status)) voided += 1
    else active += 1
  }
  const activeLabel = active === 1 ? '1 activa' : `${active} activas`
  const voidedLabel = voided === 1 ? '1 anulada' : `${voided} anuladas`
  return `${activeLabel} · ${voidedLabel}`
}
