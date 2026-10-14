export function failedContactsNotice(names: string[]): string {
  const unique = names.map((name) => name.trim()).filter(Boolean)
  if (unique.length === 0) return ''
  if (unique.length === 1) {
    return `No se pudo guardar el contacto ${unique[0]}. Agrégalo aquí para no volver a crear la ficha.`
  }
  if (unique.length === 2) {
    return `No se pudieron guardar los contactos ${unique[0]} y ${unique[1]}. Agrégalos aquí para no volver a crear la ficha.`
  }
  const head = unique.slice(0, -1).join(', ')
  const last = unique.at(-1)
  return `No se pudieron guardar los contactos ${head} y ${last}. Agrégalos aquí para no volver a crear la ficha.`
}
