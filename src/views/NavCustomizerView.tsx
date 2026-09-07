/**
 * NavCustomizerView — Server component wrapper.
 * Wraps the client NavCustomizer in Payload's DefaultTemplate to get the admin sidebar + header.
 */

import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import React from 'react'
import { redirect } from 'next/navigation'
import { NavCustomizerViewClient } from './NavCustomizerViewClient.js'
import { DEFAULT_BASE_PATH } from '../hooks/useNavPreferences.js'

export const NavCustomizerView: React.FC<AdminViewServerProps> = (props) => {
  const { initPageResult } = props

  if (!initPageResult?.req?.user) { redirect('/admin/login') }

  const { req, visibleEntities, permissions, locale } = initPageResult

  // The plugin publishes its resolved endpoint prefix on the config; the
  // client tree cannot work it out on its own.
  const resolvedBasePath =
    (req.payload.config.custom as { adminNav?: { basePath?: string } } | undefined)?.adminNav
      ?.basePath ?? DEFAULT_BASE_PATH

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={{}}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={{}}
      user={req.user!}
      visibleEntities={visibleEntities}
    >
      <NavCustomizerViewClient basePath={resolvedBasePath} />
    </DefaultTemplate>
  )
}

export default NavCustomizerView
