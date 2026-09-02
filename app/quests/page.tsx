import App from '@/app/page'

// Same fix as the catch-all route: without this, a direct load of
// /quests would start the client router at "/" (the portal) instead of
// "/quests", which is what the SPA redirects to /quest-log from.
export default function QuestsPage() {
  return <App initialPath="/quests" />
}
