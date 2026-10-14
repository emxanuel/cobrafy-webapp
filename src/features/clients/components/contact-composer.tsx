import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { useCreateContactMutation } from '@/features/clients/hooks/use-clients-queries'
import { contactFormSchema } from '@/features/clients/schemas'
import type { ContactType } from '@/features/clients/services/types'
import { Alert } from '@/features/shared/components/ui/alert'
import { Button } from '@/features/shared/components/ui/button'
import { Field, SelectInput, TextInput } from '@/features/shared/components/ui/field'
import { getApiErrorMessage, getFieldErrors } from '@/features/shared/lib/api-error'

type ComposerValues = {
  type: ContactType
  name: string
  phone: string
  relationship: string
  address?: string
  doc_type?: 'cedula' | 'pasaporte'
  document?: string
}

export function ContactComposer({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ContactType>('referencia')
  const create = useCreateContactMutation(clientId)
  const form = useForm<ComposerValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      type: 'referencia',
      name: '',
      phone: '',
      relationship: '',
      address: '',
      doc_type: 'cedula',
      document: '',
    },
  })
  const apiFields = create.isError ? getFieldErrors(create.error) : {}

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setKind('referencia')
            form.reset({
              type: 'referencia',
              name: '',
              phone: '',
              relationship: '',
              address: '',
              doc_type: 'cedula',
              document: '',
            })
            setOpen(true)
          }}
        >
          Agregar referencia
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setKind('garante')
            form.reset({
              type: 'garante',
              name: '',
              phone: '',
              relationship: '',
              address: '',
              doc_type: 'cedula',
              document: '',
            })
            setOpen(true)
          }}
        >
          Agregar garante
        </Button>
      </div>
    )
  }

  return (
    <form
      className="border-border flex max-w-lg flex-col gap-3 rounded-md border p-3"
      onSubmit={form.handleSubmit((values) =>
        create.mutate(
          {
            type: values.type,
            name: values.name,
            phone: values.phone,
            relationship: values.relationship,
            address: values.address || null,
            doc_type: values.document ? values.doc_type || 'cedula' : null,
            document: values.document || null,
          },
          { onSuccess: () => setOpen(false) },
        ),
      )}
    >
      {create.isError ? <Alert>{getApiErrorMessage(create.error)}</Alert> : null}
      <Field id="new-contact-name" label="Nombre" error={form.formState.errors.name?.message ?? apiFields.name}>
        <TextInput id="new-contact-name" {...form.register('name')} />
      </Field>
      <Field id="new-contact-phone" label="Teléfono" error={form.formState.errors.phone?.message ?? apiFields.phone}>
        <TextInput id="new-contact-phone" inputMode="tel" {...form.register('phone')} />
      </Field>
      <Field
        id="new-contact-relationship"
        label="Relación"
        error={form.formState.errors.relationship?.message ?? apiFields.relationship}
      >
        <TextInput id="new-contact-relationship" {...form.register('relationship')} />
      </Field>
      {kind === 'garante' ? (
        <>
          <Field id="new-contact-doc-type" label="Tipo de documento (opcional)">
            <SelectInput id="new-contact-doc-type" {...form.register('doc_type')}>
              <option value="cedula">Cédula</option>
              <option value="pasaporte">Pasaporte</option>
            </SelectInput>
          </Field>
          <Field id="new-contact-document" label="Documento (opcional)" error={apiFields.document}>
            <TextInput id="new-contact-document" {...form.register('document')} />
          </Field>
        </>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Guardando…' : 'Guardar contacto'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
