const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack');
const fs = require('fs');

require('dotenv').config();

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    popup: './src/popup.js',
    content: './src/content.js',
    background: './src/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  plugins: [
    new Dotenv(),

    new webpack.DefinePlugin({
      'process.env.SPOTIFY_CLIENT_ID': JSON.stringify(
        process.env.SPOTIFY_CLIENT_ID
      ),
    }),

    new CopyPlugin({
      patterns: [
        {
          from: 'public/manifest.json',
          to: 'manifest.json',
          transform(content) {
            return content
              .toString()
              .replace(/__CLIENT_ID__/g, process.env.SPOTIFY_CLIENT_ID || '');
          },
        },
      ],
    }),
  ],
};
