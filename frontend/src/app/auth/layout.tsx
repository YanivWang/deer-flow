import { type ReactNode } from "react";

/*
  The OAuth callback deliberately sits OUTSIDE the `(auth)` route group.

  `(auth)/layout.tsx` server-redirects to `/workspace` as soon as
  `getServerSideUser()` reports `authenticated`. By the time a real OIDC flow
  lands on `/auth/callback` the session cookie is already set, so that layout
  fired first and the callback page never rendered — which silently discarded
  the `?next=` deep link the user started from and made this page's `next`
  handling dead code.

  This layout deliberately provides neither AuthProvider nor I18nProvider: the
  callback page probes the session itself and renders no translated copy. It
  only needs to stay dynamic, because the page reads `useSearchParams()`.
*/
export const dynamic = "force-dynamic";

export default function AuthCallbackLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
