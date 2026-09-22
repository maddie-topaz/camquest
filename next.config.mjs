/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Codex preview reaches the dev server through the machine's LAN
  // address. Without this, Next renders the HTML but blocks the client chunks,
  // leaving controls such as START visible but inert.
  allowedDevOrigins: ['10.1.111.116'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
