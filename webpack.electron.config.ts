import path from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
  mode: 'development',
  target: 'electron-main',
  entry: {
    main: './electron/main.ts',
    preload: './electron/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/electron'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.electron.json',
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@electron': path.resolve(__dirname, 'electron'),
    },
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'keytar': 'commonjs keytar',
  },
};

export default config;
