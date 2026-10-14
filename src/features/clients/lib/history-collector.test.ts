import { describe, expect, it } from 'vitest'

import { collectorEventDetail } from './history-collector'

const names = new Map([
  ['mem-coco', 'Coco Ruta'],
  ['mem-rosa', 'Rosa Ruta'],
])

describe('collectorEventDetail', () => {
  it('el cobrador ve Asignado a ti solo cuando el id es el suyo', () => {
    expect(
      collectorEventDetail({
        role: 'cobrador',
        membershipId: 'mem-coco',
        type: 'collector_reassigned',
        fromId: 'mem-rosa',
        toId: 'mem-coco',
        nameByMembership: names,
      }),
    ).toBe('Asignado a ti')
    expect(
      collectorEventDetail({
        role: 'cobrador',
        membershipId: 'mem-coco',
        type: 'collector_assigned',
        fromId: null,
        toId: 'mem-coco',
        nameByMembership: names,
      }),
    ).toBe('Asignado a ti')
  })

  it('el cobrador ve Reasignado a otro cobrador cuando el id viene null', () => {
    expect(
      collectorEventDetail({
        role: 'cobrador',
        membershipId: 'mem-coco',
        type: 'collector_reassigned',
        fromId: null,
        toId: null,
        nameByMembership: names,
      }),
    ).toBe('Reasignado a otro cobrador')
    expect(
      collectorEventDetail({
        role: 'cobrador',
        membershipId: 'mem-coco',
        type: 'collector_assigned',
        fromId: null,
        toId: null,
        nameByMembership: names,
      }),
    ).toBe('Reasignado a otro cobrador')
  })

  it('el cobrador nunca ve una flecha X → Y', () => {
    const label = collectorEventDetail({
      role: 'cobrador',
      membershipId: 'mem-coco',
      type: 'collector_reassigned',
      fromId: 'mem-rosa',
      toId: 'mem-coco',
      nameByMembership: names,
    })
    expect(label).not.toContain('→')
  })

  it('el dueño ve los nombres con flecha', () => {
    expect(
      collectorEventDetail({
        role: 'dueño',
        membershipId: 'mem-owner',
        type: 'collector_reassigned',
        fromId: 'mem-rosa',
        toId: 'mem-coco',
        nameByMembership: names,
      }),
    ).toBe('Rosa Ruta → Coco Ruta')
    expect(
      collectorEventDetail({
        role: 'dueño',
        membershipId: 'mem-owner',
        type: 'collector_assigned',
        fromId: null,
        toId: 'mem-coco',
        nameByMembership: names,
      }),
    ).toBe('Coco Ruta')
  })
})
