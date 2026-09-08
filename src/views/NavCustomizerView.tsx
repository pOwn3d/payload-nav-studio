/**
 * NavCustomizerView — Server component wrapper.
 * Wraps the client NavCustomizer in Payload's DefaultTemplate to get the admin sidebar + header.
 */

import type { AdminViewServerProps, SanitizedConfig } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { formatAdminURL } from 'payload/shared'
import React from 'react'
import { redirect } from 'next/navigation'
import { NavCustomizerViewClient } from './NavCustomizerViewClient.js'
import { DEFAULT_BASE_PATH } from '../hooks/useNavPreferences.js'
import { hasAdminAccess } from '../utils/requireAdmin.js'

/**
 * Build an admin URL the way Payload's own `handleAuthRedirect` does, so a host
 * that moved `routes.admin` or renamed `admin.routes.login` still lands on a
 * real page instead of a hardcoded `/admin/login` that no longer exists.
 */
function adminURL(config: SanitizedConfig | undefined, path: `/${string}`): string {
  const adminRoute = config?.routes?.admin ?? '/admin'
  return formatAdminURL({ adminRoute, path })
}

/**
 * Authorization note — this is a *custom* admin view, and Payload does not gate
 * those for us.
 *
 * `RootPage` skips its `canAccessAdmin` redirect as soon as `isCustomAdminView`
 * matches the route (it only compares paths, despite its docblock), so every
 * request that carries any valid `payload-token` reaches this component. The
 * cookie is shared by every auth collection, so a holder of a plain front-office
 * account (customers, members, subscribers…) lands here authenticated. Rendering
 * `DefaultTemplate` for them would hand out the admin shell plus, through
 * `RootPage`, the FULL client config (every collection and global with its field
 * schemas) and `visibleEntities` (every non-hidden slug) — strictly more than
 * what `/default-nav` and `/discover` refuse them via `requireAdmin`.
 *
 * So the view applies the same gate as the endpoints, and redirects everyone
 * else to Payload's own unauthorized view.
 */
export const NavCustomizerView = async (
  props: AdminViewServerProps,
): Promise<React.ReactElement> => {
  const { initPageResult } = props
  const req = initPageResult?.req
  const config = req?.payload?.config

  if (!req?.user) {
    redirect(adminURL(config, config?.admin?.routes?.login ?? '/login'))
  }

  if (!(await hasAdminAccess(req))) {
    redirect(adminURL(config, config?.admin?.routes?.unauthorized ?? '/unauthorized'))
  }

  const { visibleEntities, permissions, locale } = initPageResult

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
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <NavCustomizerViewClient basePath={resolvedBasePath} />
    </DefaultTemplate>
  )
}

export default NavCustomizerView
