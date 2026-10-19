import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  useDeleteContactMutation,
  useUpdateContactMutation,
} from '@/features/clients/hooks/use-clients-queries'
import { toContactPatch } from '@/features/clients/lib/contact-patch'
import {
  CONTACT_EDITOR_FIELDS,
  hasUnrenderedFieldError,
  unrenderedFieldMessages,
} from '@/features/clients/lib/document-field-errors'
import { contactEditSchema, type ContactEditValues } from '@/features/clients/schemas'
import type { ContactRead } from '@/features/clients/services/types'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, SelectInput, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

export function ContactCard({
  clientId,
  contact,
  canEdit,
}: {
  clientId: string
  contact: ContactRead
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateContactMutation(clientId)
  const remove = useDeleteContactMutation(clientId)
  const form = useForm<ContactEditValues>({
    resolver: zodResolver(contactEditSchema),
    defaultValues: {
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      address: contact.address ?? '',
      doc_type: contact.doc_type ?? '',
      document: contact.document ?? '',
    },
  })
  const apiFields = update.isError ? getFieldErrors(update.error) : {}
  const isRenderedField = (field: string) => CONTACT_EDITOR_FIELDS.has(field)
  const bannerUnrendered = unrenderedFieldMessages(apiFields, isRenderedField)
  const showBanner =
    update.isError &&
    (Object.keys(apiFields).length === 0 ||
      hasUnrenderedFieldError(apiFields, isRenderedField))
  const documentInputId = `${contact.id}-document`

  useEffect(() => {
    if (!update.error) return
    const documentError = getFieldErrors(update.error).document
    if (!documentError) return
    const input = document.getElementById(documentInputId)
    input?.focus()
    input?.scrollIntoView?.({ block: 'center' })
  }, [update.error, documentInputId])

  if (!editing) {
    return (
      <li className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {contact.name} · {contact.phone} · {contact.relationship}
          {contact.document ? ` · ${contact.document}` : ''}
        </span>
        {canEdit ? (
          <div className="flex gap-2 self-start sm:self-auto">
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                if (!window.confirm(`¿Quitar a ${contact.name} de esta ficha?`)) return
                remove.mutate(contact.id)
              }}
            >
              Quitar
            </Button>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <li className="border-border my-2 rounded-md border p-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit((values) => {
          const payload = toContactPatch(contact, {
            type: contact.type,
            name: values.name,
            phone: values.phone,
            relationship: values.relationship,
            address: values.address,
            doc_type: values.doc_type || null,
            document: values.document,
          })
          if (Object.keys(payload).length === 0) {
            setEditing(false)
            return
          }
          update.mutate(
            { contactId: contact.id, payload },
            { onSuccess: () => setEditing(false) },
          )
        })}
      >
        {showBanner ? (
          <Alert>
            {bannerUnrendered.length
              ? bannerUnrendered.join(' ')
              : getApiErrorMessage(update.error)}
          </Alert>
        ) : null}
        <Field
          id={`${contact.id}-name`}
          label="Nombre"
          error={form.formState.errors.name?.message ?? apiFields.name}
        >
          <TextInput id={`${contact.id}-name`} {...form.register('name')} />
        </Field>
        <Field
          id={`${contact.id}-phone`}
          label="Teléfono"
          error={form.formState.errors.phone?.message ?? apiFields.phone}
        >
          <TextInput id={`${contact.id}-phone`} {...form.register('phone')} />
        </Field>
        <Field
          id={`${contact.id}-relationship`}
          label="Relación"
          error={form.formState.errors.relationship?.message ?? apiFields.relationship}
        >
          <TextInput id={`${contact.id}-relationship`} {...form.register('relationship')} />
        </Field>
        <Field id={`${contact.id}-address`} label="Dirección (opcional)">
          <TextInput id={`${contact.id}-address`} {...form.register('address')} />
        </Field>
        {contact.document_available !== false ? (
          <>
            <Field id={`${contact.id}-doc-type`} label="Tipo de documento (opcional)">
              <SelectInput id={`${contact.id}-doc-type`} {...form.register('doc_type')}>
                <option value="">Sin documento</option>
                <option value="cedula">Cédula</option>
                <option value="pasaporte">Pasaporte</option>
              </SelectInput>
            </Field>
            <Field
              id={documentInputId}
              label="Documento (opcional)"
              error={apiFields.document}
            >
              <TextInput
                id={documentInputId}
                error={apiFields.document}
                {...form.register('document', { onChange: () => update.reset() })}
              />
            </Field>
          </>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar contacto'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </li>
  )
}
