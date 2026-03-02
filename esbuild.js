const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const sharedOptions = {
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [esbuildProblemMatcherPlugin],
  };

  // Main extension entry point
  const extCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
  });

  // Worker thread entry point
  const workerCtx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/services/scanWorker.ts'],
    outfile: 'dist/scanWorker.js',
    external: [], // Worker doesn't use vscode module
  });

  if (watch) {
    await Promise.all([extCtx.watch(), workerCtx.watch()]);
  } else {
    await Promise.all([extCtx.rebuild(), workerCtx.rebuild()]);
    await Promise.all([extCtx.dispose(), workerCtx.dispose()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
