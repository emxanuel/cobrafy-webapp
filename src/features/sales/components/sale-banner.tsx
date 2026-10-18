import type { Ref } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/features/shared/components/ui/alert'
import { buttonVariants } from '@/features/shared/components/ui/button'
import type { BannerCopy } from '@/features/sales/lib/copy'
import { CREDIT_SETTINGS_LINKS_ENABLED, CREDIT_SETTINGS_PATH } from '@/features/sales/lib/flags'

export function SaleBanner({
  copy,
  bannerRef,
}: {
  copy: BannerCopy
  bannerRef?: Ref<HTMLDivElement>
}) {
  const isSettings = copy.actionTo === 'credit-settings'
  const showAction = Boolean(copy.actionLabel && copy.actionTo) && (!isSettings || CREDIT_SETTINGS_LINKS_ENABLED)
  const to = isSettings ? CREDIT_SETTINGS_PATH : copy.actionTo

  return (
    <div ref={bannerRef} tabIndex={-1}>
      <Alert
        tone={copy.tone}
        icon={copy.icon}
        title={copy.title}
        action={
          showAction && to ? (
            <Link to={to} className={`${buttonVariants({ variant: 'link' })} min-h-11`}>
              {copy.actionLabel}
            </Link>
          ) : undefined
        }
      >
        {copy.body}
      </Alert>
    </div>
  )
}
