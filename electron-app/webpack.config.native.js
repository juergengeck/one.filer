const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  // Main process config for native integration
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/main-native.ts',
    target: 'electron-main',
    module: {
      rules: [{
        test: /\.(ts|js)$/,
        include: [
          /src/,
          /..\/src/,  // Include one.filer source
        ],
        exclude: /__tests__/,
        use: [{ 
          loader: 'ts-loader', 
          options: { 
            transpileOnly: true,
            compilerOptions: {
              module: 'esnext',
              target: 'es2022'
            }
          } 
        }]
      }]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
      libraryTarget: 'commonjs2'
    },
    resolve: {
      extensions: ['.ts', '.js', '.mjs'],
      alias: {
        '@refinio': path.resolve(__dirname, '../node_modules/@refinio')
      },
      mainFields: ['module', 'main']
    },
    externals: {
      electron: 'electron',
      'node:fs': 'commonjs fs',
      'node:path': 'commonjs path',
      'node:url': 'commonjs url',
      'node:util': 'commonjs util',
      'node:crypto': 'commonjs crypto',
      'node:child_process': 'commonjs child_process'
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
  }
];