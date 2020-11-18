import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import path from 'path';

export default {
  input: 'bootstrap/liveview.bootstrap.ts',
  output: {
    dir: 'dist'
  },
  plugins: [
    nodeResolve({
      rootDir: path.resolve(__dirname, '..', '..'),
      preferBuiltins: true
    }),
    commonjs({
      ignore: ['tty', 'os']
    }),
    typescript({
      tsconfig: './tsconfig.bootstrap.json'
    })
  ],
  external: ['tty', 'os']
};
