/**
 * Development-only Vite middleware.
 *
 * This lives outside `server.ts` and is loaded through a non-literal dynamic
 * import so the Netlify function bundler does not follow it. Vite pulls in
 * native Rollup/Lightning CSS binaries that have no place in a serverless
 * bundle, and the production function never takes this branch.
 */
export async function attachDevServer(app) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      ws: process.env.DISABLE_HMR === 'true' ? false : undefined,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
