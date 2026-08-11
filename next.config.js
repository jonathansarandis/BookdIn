/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // pdfkit (invoice PDF generation) loads its standard fonts via a __dirname-relative
  // fs.readFileSync at runtime. Webpack-bundling it into .next/server/vendor-chunks
  // moves that runtime location away from node_modules/pdfkit/js/data, so the font
  // lookup 404s (ENOENT) in every route that calls generateInvoicePdf. Excluding it
  // from bundling makes it load via Node's normal require() instead, which resolves
  // relative to its real location in node_modules and keeps the font lookup intact.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
}

module.exports = nextConfig
