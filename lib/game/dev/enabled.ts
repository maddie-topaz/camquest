// Developer tools (/dev and the admin API) are on outside production, and
// on in production only when NEXT_PUBLIC_CAMQUEST_DEV_TOOLS=1 is set —
// which is how the reset page and passcode list stay reachable on the day.
// NEXT_PUBLIC_ so the same check runs in the browser and on the server.
export const devToolsEnabled =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_CAMQUEST_DEV_TOOLS === '1'
