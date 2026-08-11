/** @type {import("next").NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // pdfkit (invoice PDF generation) loads its standard fonts via a __dirname-relative
  // fs.readFileSync at runtime. Webpack-bundling it into .next/server/vendor-chunks
  // moves that runtime location away from node_modules/pdfkit/js/data, so the font
  // lookup 404s (ENOENT) in every route that calls generateInvoicePdf. Excluding it
  // from bundling makes it load via Node's normal require() instead, which resolves
  // relative to its real location in node_modules and keeps the font lookup intact
  // locally (next dev / next build+start) — confirmed working both ways.
  //
  // That alone wasn't enough on Vercel: its serverless function bundler (Node File
  // Trace) didn't pick up pdfkit's data/*.afm files even though the module itself
  // loaded fine, causing a 503 on every PDF request in production while the exact
  // same build passed locally. outputFileTracingIncludes force-includes those font
  // files in the deployed function regardless of what NFT's static analysis finds.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
    outputFileTracingIncludes: {
      '/**/*': ['./node_modules/pdfkit/js/data/**/*'],
    },
  },
}

module.exports = nextConfig
