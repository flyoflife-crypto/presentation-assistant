import path from 'path';
import { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const config: Configuration = {
  mode: 'development',
  target: 'electron-renderer',
  entry: {
    settings: './src/windows/SettingsWindow/index.tsx',
    captionFeed: './src/windows/CaptionFeedWindow/index.tsx',
    prepChat: './src/windows/PrepChatWindow/index.tsx',
    teleprompter: './src/windows/TeleprompterWindow/index.tsx',
    gazeTrainer: './src/windows/GazeTrainerWindow/index.tsx',
    roomMicCapture: './src/windows/RoomMicCaptureWindow/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@electron': path.resolve(__dirname, 'electron'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/windows/SettingsWindow/index.html',
      filename: 'settings.html',
      chunks: ['settings'],
    }),
    new HtmlWebpackPlugin({
      template: './src/windows/CaptionFeedWindow/index.html',
      filename: 'captionFeed.html',
      chunks: ['captionFeed'],
    }),
    new HtmlWebpackPlugin({
      template: './src/windows/PrepChatWindow/index.html',
      filename: 'prepChat.html',
      chunks: ['prepChat'],
    }),
    new HtmlWebpackPlugin({
      template: './src/windows/TeleprompterWindow/index.html',
      filename: 'teleprompter.html',
      chunks: ['teleprompter'],
    }),
    new HtmlWebpackPlugin({
      template: './src/windows/GazeTrainerWindow/index.html',
      filename: 'gazeTrainer.html',
      chunks: ['gazeTrainer'],
    }),
    new HtmlWebpackPlugin({
      template: './src/windows/RoomMicCaptureWindow/index.html',
      filename: 'roomMicCapture.html',
      chunks: ['roomMicCapture'],
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
  },
};

export default config;
