import path from 'path';

export default {
  base: '.',
  resolve: {
    alias: {
      gate: path.resolve(__dirname, 'src'),
    },
  },
};
