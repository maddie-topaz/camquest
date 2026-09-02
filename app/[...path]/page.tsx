import App from '@/app/page'

// Camquest's actual routing (portal, quest log, archive, individual quests)
// is all client-side (react-router's MemoryRouter inside app/page.tsx). That
// router only ever starts at "/", so a hard navigation or refresh on any
// other path — e.g. /quest-log — hit Next's server, found no matching
// page, and 404'd.
//
// This catch-all route makes every other path resolve to a real Next.js
// page, and hands the requested path down as `initialPath` so the client
// router opens directly on the right screen instead of always starting
// at the portal.
export default async function CatchAllPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return <App initialPath={`/${path.join('/')}`} />
}
