import path from 'node:path';
import { fileURLToPath } from 'node:url';
import toml from 'toml';
import yaml from 'yamljs';
import json5 from 'json5';
import CopyPlugin from 'copy-webpack-plugin';
import { output } from 'three/tsl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './src/main.js',
  plugins: [new CopyPlugin({
    patterns: [
      { from: "./src/index.html", to: "index.html" },
      { from: "./src/style.css", to: "style.css" },
    ],
  }),],
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    //  assetModuleFilename: 'assets/[hash][ext][query]',
  },
  experiments: {
    asyncWebAssembly: true,
    importAsync: true
  },
  module: {
    rules: [
      // { test: /\.\/src\/index\.html$/, use: [{loader: 'file-loader', options: {outputPath: '[name].[ext]'}}] },
      // { test: /\.\/src\/style\.css$/, use: [{loader: 'file-loader', options: {outputPath: '[name].[ext]'}}] },
      {
        test: /\.(glb|gltf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[hash][ext][query]'
        }
      },
      // {
      // test: /assets(\/|\\)/,
      // use: ['file-loader'],
      // },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(csv|tsv)$/i,
        use: ['csv-loader'],
      },
      {
        test: /\.xml$/i,
        use: ['xml-loader'],
      },
      {
        test: /\.toml$/i,
        type: 'json',
        parser: {
          parse: toml.parse,
        },
      },
      {
        test: /\.yaml$/i,
        type: 'json',
        parser: {
          parse: yaml.parse,
        },
      },
      {
        test: /\.json5$/i,
        type: 'json',
        parser: {
          parse: json5.parse,
        },
      },
    ],
  },
};