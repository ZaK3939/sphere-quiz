import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.SIGNER_PRIVATE_KEY': JSON.stringify(env.SIGNER_PRIVATE_KEY),
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
