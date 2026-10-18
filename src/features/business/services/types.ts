export type BusinessRead = {
  id: string
  name: string
  phone: string | null
  rnc: string | null
  address: string | null
  currency: string
  timezone: string
}

export type BusinessPatch = {
  name?: string
  phone?: string | null
  rnc?: string | null
  address?: string | null
}
