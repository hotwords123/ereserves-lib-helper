import { defineConfig } from 'vite';
import monkey, { cdn } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'EReserves Lib Helper',
        version: '0.1.0',
        description: 'Download textbooks from Tsinghua EReserves',
        author: 'hotwords123',
        icon: 'https://www.google.com/s2/favicons?sz=64&domain=www.tsinghua.edu.cn',
        namespace: 'https://github.com/hotwords123/ereserves-lib-helper',
        match: ['http://ereserves.lib.tsinghua.edu.cn/readkernel/ReadJPG/JPGJsNetPage/*'],
      },
      build: {
        externalGlobals: {
          jspdf: cdn.jsdelivr('jspdf', 'dist/jspdf.umd.min.js'),
        },
      },
    }),
  ],
});
