import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

import {
  clientFormSchema,
  emptyClientForm,
  type ClientFormValues,
} from '@/features/clients/schemas'
import type { ClientRead, ClientWrite } from '@/features/clients/services/types'
import type { Member } from '@/features/members/services/types'
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

function toWrite(values: ClientFormValues): ClientWrite {
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    document_type: values.document_type,
    document_number: values.document_number,
    phone: values.phone,
    email: values.email ? String(values.email) : null,
    address: values.address || null,
    notes: values.notes || null,
    collector_id: values.collector_id || null,
    references: values.references,
    guarantors: values.guarantors,
  }
}

function fromClient(client: ClientRead): ClientFormValues {
  return {
    first_name: client.first_name,
    last_name: client.last_name,
    document_type: client.document_type,
    document_number: client.document_number,
    phone: client.phone,
    email: client.email ?? '',
    address: client.address ?? '',
    notes: client.notes ?? '',
    collector_id: client.collector_id ?? '',
    references: client.references,
    guarantors: client.guarantors,
  }
}

export function ClientForm({
  client,
  collectors,
  pending,
  error,
  submitLabel,
  onSubmit,
}: {
  client?: ClientRead
  collectors: Member[]
  pending: boolean
  error: unknown
  submitLabel: string
  onSubmit: (payload: ClientWrite) => void
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? fromClient(client) : emptyClientForm(),
  })
  const references = useFieldArray({ control: form.control, name: 'references' })
  const guarantors = useFieldArray({ control: form.control, name: 'guarantors' })
  const apiFields = error ? getFieldErrors(error) : {}
  const forbidden = isApiError(error) && error.status === 403
  const showBanner = Boolean(error) && (forbidden || Object.keys(apiFields).length === 0)

  useEffect(() => {
    if (!error) return
    for (const [name, message] of Object.entries(getFieldErrors(error))) {
      form.setError(name as 'document_number', { type: 'server', message })
    }
  }, [error, form])

  function fieldError(name: string) {
    const parts = name.split('.')
    let current: unknown = form.formState.errors
    for (const part of parts) {
      if (!current || typeof current !== 'object') return apiFields[name]
      current = (current as Record<string, unknown>)[part]
    }
    const message =
      current && typeof current === 'object' && 'message' in current
        ? String((current as { message?: string }).message ?? '')
        : ''
    return message || apiFields[name]
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) => onSubmit(toWrite(values)))}
      noValidate
    >
      {showBanner ? (
        <Alert>
          {forbidden
            ? 'No tienes permiso para guardar este cliente.'
            : getApiErrorMessage(error, 'No se pudo guardar el cliente.')}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="m-0 text-xl">Datos de la persona</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="first_name" label="Nombre" error={fieldError('first_name')}>
            <TextInput
              id="first_name"
              autoComplete="given-name"
              error={fieldError('first_name')}
              {...form.register('first_name')}
            />
          </Field>
          <Field id="last_name" label="Apellido" error={fieldError('last_name')}>
            <TextInput
              id="last_name"
              autoComplete="family-name"
              error={fieldError('last_name')}
              {...form.register('last_name')}
            />
          </Field>
          <Field
            id="document_type"
            label="Tipo de documento"
            error={fieldError('document_type')}
          >
            <SelectInput id="document_type" {...form.register('document_type')}>
              <option value="cedula">Cédula</option>
              <option value="pasaporte">Pasaporte</option>
            </SelectInput>
          </Field>
          <Field
            id="document_number"
            label="Número de documento"
            error={fieldError('document_number')}
          >
            <TextInput
              id="document_number"
              autoComplete="off"
              error={fieldError('document_number')}
              {...form.register('document_number')}
            />
          </Field>
          <Field id="phone" label="Teléfono" error={fieldError('phone')}>
            <TextInput
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              error={fieldError('phone')}
              {...form.register('phone')}
            />
          </Field>
          <Field id="email" label="Correo (opcional)" error={fieldError('email')}>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              error={fieldError('email')}
              {...form.register('email')}
            />
          </Field>
        </div>
        <Field id="address" label="Dirección (opcional)" error={fieldError('address')}>
          <TextInput id="address" {...form.register('address')} />
        </Field>
        <Field
          id="collector_id"
          label="Cobrador asignado"
          error={fieldError('collector_id')}
        >
          <SelectInput id="collector_id" {...form.register('collector_id')}>
            <option value="">Sin asignar</option>
            {collectors.map((member) => (
              <option key={member.id} value={member.user_id}>
                {member.first_name} {member.last_name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="notes" label="Notas (opcional)">
          <TextArea id="notes" {...form.register('notes')} />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-xl">Referencias</h2>
          <Button
            variant="outline"
            onClick={() =>
              references.append({ name: '', phone: '', relationship: '' })
            }
          >
            Agregar referencia
          </Button>
        </div>
        {references.fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="border-border flex flex-col gap-3 rounded-md border p-3"
          >
            <legend className="px-1 text-sm">Referencia {index + 1}</legend>
            <Field
              id={`references.${index}.name`}
              label="Nombre"
              error={fieldError(`references.${index}.name`)}
            >
              <TextInput
                id={`references.${index}.name`}
                {...form.register(`references.${index}.name`)}
              />
            </Field>
            <Field
              id={`references.${index}.phone`}
              label="Teléfono"
              error={fieldError(`references.${index}.phone`)}
            >
              <TextInput
                id={`references.${index}.phone`}
                inputMode="tel"
                {...form.register(`references.${index}.phone`)}
              />
            </Field>
            <Field
              id={`references.${index}.relationship`}
              label="Relación"
              error={fieldError(`references.${index}.relationship`)}
            >
              <TextInput
                id={`references.${index}.relationship`}
                {...form.register(`references.${index}.relationship`)}
              />
            </Field>
            <Button variant="ghost" onClick={() => references.remove(index)}>
              Quitar referencia
            </Button>
          </fieldset>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-xl">Fiadores</h2>
          <Button
            variant="outline"
            onClick={() =>
              guarantors.append({
                first_name: '',
                last_name: '',
                document_type: 'cedula',
                document_number: '',
                phone: '',
                relationship: '',
              })
            }
          >
            Agregar fiador
          </Button>
        </div>
        {guarantors.fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="border-border flex flex-col gap-3 rounded-md border p-3"
          >
            <legend className="px-1 text-sm">Fiador {index + 1}</legend>
            <Field
              id={`guarantors.${index}.first_name`}
              label="Nombre"
              error={fieldError(`guarantors.${index}.first_name`)}
            >
              <TextInput
                id={`guarantors.${index}.first_name`}
                {...form.register(`guarantors.${index}.first_name`)}
              />
            </Field>
            <Field
              id={`guarantors.${index}.last_name`}
              label="Apellido"
              error={fieldError(`guarantors.${index}.last_name`)}
            >
              <TextInput
                id={`guarantors.${index}.last_name`}
                {...form.register(`guarantors.${index}.last_name`)}
              />
            </Field>
            <Field
              id={`guarantors.${index}.document_type`}
              label="Tipo de documento"
            >
              <SelectInput
                id={`guarantors.${index}.document_type`}
                {...form.register(`guarantors.${index}.document_type`)}
              >
                <option value="cedula">Cédula</option>
                <option value="pasaporte">Pasaporte</option>
              </SelectInput>
            </Field>
            <Field
              id={`guarantors.${index}.document_number`}
              label="Número de documento"
              error={fieldError(`guarantors.${index}.document_number`)}
            >
              <TextInput
                id={`guarantors.${index}.document_number`}
                {...form.register(`guarantors.${index}.document_number`)}
              />
            </Field>
            <Field
              id={`guarantors.${index}.phone`}
              label="Teléfono"
              error={fieldError(`guarantors.${index}.phone`)}
            >
              <TextInput
                id={`guarantors.${index}.phone`}
                inputMode="tel"
                {...form.register(`guarantors.${index}.phone`)}
              />
            </Field>
            <Field
              id={`guarantors.${index}.relationship`}
              label="Relación"
              error={fieldError(`guarantors.${index}.relationship`)}
            >
              <TextInput
                id={`guarantors.${index}.relationship`}
                {...form.register(`guarantors.${index}.relationship`)}
              />
            </Field>
            <Button variant="ghost" onClick={() => guarantors.remove(index)}>
              Quitar fiador
            </Button>
          </fieldset>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
