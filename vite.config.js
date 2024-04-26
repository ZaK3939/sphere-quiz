import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      IS_DEV_MODE: JSON.stringify(command === 'serve'),
      'process.env.SIGNER_PRIVATE_KEY': JSON.stringify(env.SIGNER_PRIVATE_KEY),
      'process.env.PUBLIC_VERCEL_URL': JSON.stringify(env.PUBLIC_VERCEL_URL),
    },
    base: '',
    resolve: {
      alias: {
        gate: path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
