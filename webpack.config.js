const MODE = "development";
const enabledSourceMap = MODE === "development";

const path = require("path");
const outputPath = path.resolve(__dirname, "public");

const mainConfig = {
  mode: MODE,
  entry: "./src/index.ts",
  devServer: {
    contentBase: outputPath,
    // inlineモードだとAudioWorkletProcessorのバンドルにHMRのモジュールが挿入され、
    // AudioAPIがProcessorを読み込んだときにエラーが出る...
    inline: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
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
              importLoaders: 2,
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: enabledSourceMap,
            },
          },
        ],
      },
    ],
  },
  output: {
    path: `${__dirname}/public`,
    filename: "main.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
  },
};

const audioWorkletProcessorConfig = {
  mode: MODE,
  target: "webworker",
  entry: {
    "AudioWorkletProcessor/ForegroundNormalizer":
      "./src/AudioWorkletProcessor/ForegroundNormalizer.ts",
    "AudioWorkletProcessor/CmpExper": "./src/AudioWorkletProcessor/CmpExper.ts",
  },
  devServer: {
    contentBase: outputPath,
  },
  output: {
    path: `${__dirname}/public`,
    filename: "[name].js",
    globalObject: "this",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
};

module.exports = [mainConfig, audioWorkletProcessorConfig];
