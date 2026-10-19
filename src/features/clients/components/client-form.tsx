import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form'

import {
  CLIENT_SAVED_BANNER_BODY,
  CLIENT_SAVED_BANNER_TITLE,
  CONTACT_SAVED_LABEL,
  GO_TO_RECORD_LABEL,
} from '@/features/clients/lib/complete-guarantor'
import {
  hasUnrenderedFieldError,
  isClientFormField,
  isPartialClientSaveError,
  unrenderedFieldMessages,
} from '@/features/clients/lib/document-field-errors'
import {
  clientFormSchema,
  emptyClientForm,
  type ClientFormValues,
} from '@/features/clients/schemas'
import { useCheckClientMutation } from '@/features/clients/hooks/use-clients-queries'
import type {
  ClientCreate,
  ClientDetail,
  ClientRead,
  ContactDraft,
  ContactRead,
} from '@/features/clients/services/types'
import type { MemberRead } from '@/features/members/services/types'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import {
  Field,
  SelectInput,
  TextArea,
  TextInput,
} from '@/features/shared/components/ui/field'
import {
  getApiErrorMessage,
  getFieldErrors,
  isApiError,
} from '@/features/shared/lib/api-error'
import { UNCONFIRMED_MUTATION_MESSAGE } from '@/features/shared/services/client'

export type ClientFormSubmit = {
  client: ClientCreate
  contacts: ContactDraft[]
  resume?: {
    client: ClientRead
    previousContacts: ContactRead[]
  }
}

function mergeContacts(current: ContactRead[], incoming: ContactRead[]) {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) byId.set(item.id, item)
  return [...byId.values()]
}

function toSubmit(
  values: ClientFormValues,
  savedByIndex: Record<number, ContactRead> = {},
): ClientFormSubmit {
  return {
    client: {
      name: values.name,
      doc_type: values.doc_type,
      document: values.document,
      phone: values.phone,
      address: values.address,
      notes: values.notes || null,
      collector_membership_id: values.collector_membership_id || null,
    },
    contacts: values.contacts.map((item, index) => ({
      id: item.contact_id || savedByIndex[index]?.id,
      type: item.type,
      name: item.name,
      phone: item.phone,
      relationship: item.relationship,
      address: item.address || null,
      doc_type: item.doc_type === 'cedula' || item.doc_type === 'pasaporte' ? item.doc_type : null,
      document: item.document || null,
    })),
  }
}

function fromClient(client: ClientDetail): ClientFormValues {
  return {
    name: client.name,
    doc_type: client.doc_type,
    document: client.document ?? '',
    phone: client.phone,
    address: client.address,
    notes: client.notes ?? '',
    collector_membership_id: client.collector_membership_id ?? '',
    contacts: client.contacts
      .filter((item) => item.is_active)
      .map((item) => ({
        contact_id: item.id,
        type: item.type,
        name: item.name,
        phone: item.phone,
        relationship: item.relationship,
        address: item.address ?? '',
        doc_type: item.doc_type ?? '',
        document: item.document ?? '',
      })),
  }
}

export function ClientForm({
  client,
  collectors,
  pending,
  error,
  submitLabel,
  completingGuarantor = false,
  onSubmit,
  onGoToRecord,
}: {
  client?: ClientDetail
  collectors: MemberRead[]
  pending: boolean
  error: unknown
  submitLabel: string
  completingGuarantor?: boolean
  onSubmit: (payload: ClientFormSubmit) => void
  onGoToRecord?: () => void
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? fromClient(client) : emptyClientForm(),
  })
  const contacts = useFieldArray({ control: form.control, name: 'contacts' })
  const check = useCheckClientMutation()
  const [errorForDismiss, setErrorForDismiss] = useState(error)
  const [dismissedFields, setDismissedFields] = useState<Set<string>>(() => new Set())
  const [resumeClient, setResumeClient] = useState<ClientRead | null>(() => client ?? null)
  const [resumeContacts, setResumeContacts] = useState<ContactRead[]>(
    () => client?.contacts.filter((item) => item.is_active) ?? [],
  )
  const [savedByIndex, setSavedByIndex] = useState<Record<number, ContactRead>>({})
  if (error !== errorForDismiss) {
    setErrorForDismiss(error)
    setDismissedFields(new Set())
    if (isPartialClientSaveError(error)) {
      setResumeClient(error.savedClient)
      setResumeContacts((current) => mergeContacts(current, Object.values(error.createdByIndex)))
      setSavedByIndex((current) => ({ ...current, ...error.createdByIndex }))
    }
  }
  const saveFields = error ? getFieldErrors(error) : {}
  const checkFields = check.isError ? getFieldErrors(check.error) : {}
  const apiFields = { ...checkFields, ...saveFields }
  const forbidden = isApiError(error) && error.status === 403
  const timedOut = isApiError(error) && error.status === 0 && !client
  const isRenderedField = (field: string) => isClientFormField(field, contacts.fields.length)
  const saveHasUnrendered = hasUnrenderedFieldError(saveFields, isRenderedField)
  const checkHasUnrendered = hasUnrenderedFieldError(checkFields, isRenderedField)
  const showBanner =
    (Boolean(error) &&
      (forbidden || timedOut || Object.keys(saveFields).length === 0 || saveHasUnrendered)) ||
    (!error &&
      check.isError &&
      (Object.keys(checkFields).length === 0 || checkHasUnrendered))
  const bannerUnrendered = unrenderedFieldMessages(
    error ? saveFields : checkFields,
    isRenderedField,
  )

  useEffect(() => {
    if (isPartialClientSaveError(error)) {
      for (const [index, saved] of Object.entries(error.createdByIndex)) {
        form.setValue(
          `contacts.${index}.contact_id` as FieldPath<ClientFormValues>,
          saved.id,
        )
      }
    }
    const source = error ?? (check.isError ? check.error : undefined)
    if (!source) return
    const mapped = getFieldErrors(source)
    const names = Object.keys(mapped)
    for (const [name, message] of Object.entries(mapped)) {
      form.setError(name as FieldPath<ClientFormValues>, { type: 'server', message })
    }
    const first = names[0]
    if (!first) return
    form.setFocus(first as FieldPath<ClientFormValues>)
    document.getElementById(first)?.scrollIntoView?.({ block: 'center' })
  }, [error, check.error, check.isError, form])

  function dismissField(name: FieldPath<ClientFormValues>) {
    form.clearErrors(name)
    setDismissedFields((current) => {
      const next = new Set(current)
      next.add(name)
      return next
    })
  }

  function fieldError(name: string) {
    const parts = name.split('.')
    let current: unknown = form.formState.errors
    for (const part of parts) {
      if (!current || typeof current !== 'object') break
      current = (current as Record<string, unknown>)[part]
    }
    const message =
      current && typeof current === 'object' && 'message' in current
        ? String((current as { message?: string }).message ?? '')
        : ''
    if (message) return message
    if (dismissedFields.has(name)) return undefined
    return apiFields[name]
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          ...toSubmit(values, savedByIndex),
          resume: resumeClient
            ? { client: resumeClient, previousContacts: resumeContacts }
            : undefined,
        }),
      )}
      noValidate
    >
      {completingGuarantor ? (
        <Alert tone="warning" icon="⚠" title={CLIENT_SAVED_BANNER_TITLE}>
          {CLIENT_SAVED_BANNER_BODY}
        </Alert>
      ) : null}
      {showBanner ? (
        <Alert>
          {forbidden
            ? 'No tienes permiso para guardar este cliente.'
            : timedOut
              ? UNCONFIRMED_MUTATION_MESSAGE
              : bannerUnrendered.length
                ? bannerUnrendered.join(' ')
                : getApiErrorMessage(
                    error ?? check.error,
                    'No se pudo guardar el cliente.',
                  )}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-xl">Datos de la persona</h2>
        <Field id="name" label="Nombre" error={fieldError('name')}>
          <TextInput
            id="name"
            autoComplete="name"
            error={fieldError('name')}
            {...form.register('name')}
            disabled={completingGuarantor}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="doc_type" label="Tipo de documento" error={fieldError('doc_type')}>
            <SelectInput
              id="doc_type"
              {...form.register('doc_type', {
                onChange: () => {
                  dismissField('document')
                  check.reset()
                },
              })}
              disabled={completingGuarantor}
            >
              <option value="cedula">Cédula</option>
              <option value="pasaporte">Pasaporte</option>
            </SelectInput>
          </Field>
          <Field id="document" label="Número de documento" error={fieldError('document')}>
            <TextInput
              id="document"
              autoComplete="off"
              error={fieldError('document')}
              {...form.register('document', {
                onChange: () => {
                  dismissField('document')
                  check.reset()
                },
                onBlur: () => {
                  if (completingGuarantor) return
                  const document = form.getValues('document').trim()
                  const docType = form.getValues('doc_type')
                  if (!document) return
                  check.mutate({ doc_type: docType, document })
                },
              })}
              disabled={completingGuarantor}
            />
          </Field>
          {check.data?.found && !completingGuarantor ? (
            <Alert>
              {check.data.is_blocked
                ? `Ese documento ya está en una ficha bloqueada${check.data.blocked_reason ? `: ${check.data.blocked_reason}` : '.'}`
                : 'Ya hay un cliente con este documento.'}
            </Alert>
          ) : null}
          <Field id="phone" label="Teléfono" error={fieldError('phone')}>
            <TextInput
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              error={fieldError('phone')}
              {...form.register('phone')}
              disabled={completingGuarantor}
            />
          </Field>
          <Field
            id="collector_membership_id"
            label="Cobrador asignado"
            error={fieldError('collector_membership_id')}
          >
            <SelectInput
              id="collector_membership_id"
              {...form.register('collector_membership_id')}
              disabled={completingGuarantor}
            >
              <option value="">Sin asignar</option>
              {collectors.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field id="address" label="Dirección" error={fieldError('address')}>
          <TextInput
            id="address"
            {...form.register('address')}
            disabled={completingGuarantor}
          />
        </Field>
        <Field id="notes" label="Notas (opcional)">
          <TextArea
            id="notes"
            {...form.register('notes')}
            disabled={completingGuarantor}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-xl">Referencias y garantes</h2>
          {completingGuarantor ? null : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  contacts.append({
                    contact_id: '',
                    type: 'referencia',
                    name: '',
                    phone: '',
                    relationship: '',
                    address: '',
                    doc_type: '',
                    document: '',
                  })
                }
              >
                Agregar referencia
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  contacts.append({
                    contact_id: '',
                    type: 'garante',
                    name: '',
                    phone: '',
                    relationship: '',
                    address: '',
                    doc_type: '',
                    document: '',
                  })
                }
              >
                Agregar garante
              </Button>
            </div>
          )}
        </div>
        {contacts.fields.map((field, index) => {
          const kind = field.type
          const rowLocked = Boolean(savedByIndex[index])
          return (
            <fieldset
              key={field.id}
              className="border-border flex flex-col gap-3 rounded-md border p-3"
            >
              <legend className="px-1 text-sm">
                {kind === 'garante' ? `Garante ${index + 1}` : `Referencia ${index + 1}`}
              </legend>
              {rowLocked ? (
                <p className="text-success m-0 flex items-center gap-1 text-sm font-medium">
                  <Check className="size-4" size={16} aria-hidden="true" />
                  {CONTACT_SAVED_LABEL}
                </p>
              ) : null}
              <Field
                id={`contacts.${index}.name`}
                label="Nombre"
                error={fieldError(`contacts.${index}.name`)}
              >
                <TextInput
                  id={`contacts.${index}.name`}
                  {...form.register(`contacts.${index}.name`)}
                  disabled={rowLocked}
                />
              </Field>
              <Field
                id={`contacts.${index}.phone`}
                label="Teléfono"
                error={fieldError(`contacts.${index}.phone`)}
              >
                <TextInput
                  id={`contacts.${index}.phone`}
                  inputMode="tel"
                  {...form.register(`contacts.${index}.phone`)}
                  disabled={rowLocked}
                />
              </Field>
              <Field
                id={`contacts.${index}.relationship`}
                label="Relación"
                error={fieldError(`contacts.${index}.relationship`)}
              >
                <TextInput
                  id={`contacts.${index}.relationship`}
                  {...form.register(`contacts.${index}.relationship`)}
                  disabled={rowLocked}
                />
              </Field>
              {kind === 'garante' ? (
                <>
                  <Field
                    id={`contacts.${index}.doc_type`}
                    label="Tipo de documento (opcional)"
                  >
                    <SelectInput
                      id={`contacts.${index}.doc_type`}
                      {...form.register(`contacts.${index}.doc_type`)}
                      disabled={rowLocked}
                    >
                      <option value="">Sin documento</option>
                      <option value="cedula">Cédula</option>
                      <option value="pasaporte">Pasaporte</option>
                    </SelectInput>
                  </Field>
                  <Field
                    id={`contacts.${index}.document`}
                    label="Número de documento (opcional)"
                    error={rowLocked ? undefined : fieldError(`contacts.${index}.document`)}
                  >
                    <TextInput
                      id={`contacts.${index}.document`}
                      error={rowLocked ? undefined : fieldError(`contacts.${index}.document`)}
                      {...form.register(`contacts.${index}.document`, {
                        onChange: () =>
                          dismissField(`contacts.${index}.document` as FieldPath<ClientFormValues>),
                      })}
                      disabled={rowLocked}
                    />
                  </Field>
                </>
              ) : null}
              {completingGuarantor || rowLocked ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const name = form.getValues(`contacts.${index}.name`)
                    if (
                      !window.confirm(
                        `¿Quitar a ${name.trim() || 'este contacto'} de esta ficha?`,
                      )
                    ) {
                      return
                    }
                    contacts.remove(index)
                  }}
                >
                  Quitar
                </Button>
              )}
            </fieldset>
          )
        })}
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button
          type="submit"
          className={completingGuarantor ? 'min-h-12 w-full' : 'w-full sm:w-auto'}
          disabled={pending}
        >
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        {completingGuarantor && onGoToRecord ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={onGoToRecord}
          >
            {GO_TO_RECORD_LABEL}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
