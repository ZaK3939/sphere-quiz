import path from 'path';

export default {
  base: '/sphere-game/',
  resolve: {
    alias: {
      gate: path.resolve(__dirname, 'src'),
    },
  },
};
