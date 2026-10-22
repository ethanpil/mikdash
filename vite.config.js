import { defineConfig } from 'vite';

// perf-1: the boot imports each system's chunk only when that system starts (time, env, render, player, people, sim and
// its ~25 choreography chunks, audio, ui): a waterfall of round trips on the network. This lists those chunks in a
// <meta name="mk-boot-chunks"> tag; main.js modulepreloads them (fetch + parse, no evaluation) as the boot begins, so
// they arrive while the world is built. Optional chunks stay on demand: the post pipeline (medium+, main.js preloads it
// when the tier needs it), debug overlays, the people demo and the materials preview.
const OPTIONAL = /\/(debug|demo|preview|testscene)\.js$|\/render\/post\.js$|\/dev\//;

function bootChunks() {
  return {
    name: 'mikdash-boot-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const entry = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry);
        if (!entry) return html;
        const listed = new Set();
        const stack = [...entry.dynamicImports];
        while (stack.length) {
          const f = stack.pop();
          const c = bundle[f];
          if (listed.has(f) || !c || c.type !== 'chunk') continue;
          if (c.facadeModuleId && OPTIONAL.test(c.facadeModuleId.replace(/\\/g, '/'))) continue;
          listed.add(f);
          for (const css of c.viteMetadata?.importedCss || []) listed.add(css); // loaded with the chunk: preloaded too
          stack.push(...c.imports, ...c.dynamicImports);
        }
        for (const f of entry.imports) listed.delete(f); // the entry's static imports are preloaded by vite already
        return [{ tag: 'meta', attrs: { name: 'mk-boot-chunks', content: [...listed].join(' ') }, injectTo: 'head' }];
      },
    },
  };
}

// base './' so the build works under GitHub Pages' /mikdash/ subpath and locally.
export default defineConfig({
  base: './',
  plugins: [bootChunks()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: '127.0.0.1' },
});
