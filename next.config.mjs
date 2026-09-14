/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-rendered PDFs (app/api/documents/pdf) run headless Chromium.
  // Keep both packages external so @sparticuz/chromium resolves its Linux
  // binary from node_modules at runtime, and make sure output tracing ships
  // that binary with the route (otherwise: "/var/task/bin does not exist").
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/documents/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
