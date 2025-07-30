const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  // Main process config
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/main.ts',
    target: 'electron-main',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        exclude: /__tests__/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }]
      }]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  },
  // Preload script config
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/preload.ts',
    target: 'electron-preload',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        exclude: /__tests__/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }]
      }]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'preload.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  },
  // React renderer config
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/renderer-react.tsx',
    target: 'electron-renderer',
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          include: /src/,
          exclude: /__tests__/,
          use: [{ loader: 'ts-loader', options: { transpileOnly: true } }]
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer-react.js'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    }
  },
  // Simple renderer config
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/renderer.ts',
    target: 'electron-renderer',
    module: {
      rules: [{
        test: /\.ts$/,
        include: /src/,
        exclude: /__tests__/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }]
      }]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    }
  }
];