const MODE = "development";
const enabledSourceMap = MODE === "development";

const path = require('path');
const outputPath = path.resolve(__dirname, 'public');

module.exports = {
  mode: MODE,
  entry: './src/index.ts',
  devServer: {
    contentBase: outputPath
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
      {
        test: /\.scss/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              url: false,
              sourceMap: enabledSourceMap,
              importLoaders: 2
            }
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: enabledSourceMap
            }
          }
        ]
      }
    ],
  },
  output: {
    path: `${__dirname}/public`,
    filename: "main.js"
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"]
  }
};
