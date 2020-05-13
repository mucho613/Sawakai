/* eslint-disable */

// 前景音をうまく正規化するAudioWorkletProcessor
// 人が喋っている音声を想定している
class ForegroundNormalizer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 256;
    this.buffer = new Array(this.capacity);
    this.itr = 0;

    // ヒストグラムの半減期(音圧レベルがharflife個届いたら半減)
    // 大きいと正規化が安定するが反応が鈍くなる
    // 時間単位の半減期 = capacity * harfLife / (サンプリングレート)
    this.harfLife = 1000;

    this.a = 1 - 2 ** (-1 / this.harfLife);
    this.histMin = -60; // 音圧レベルの下限値 [dBFS(peak)]
    this.histMax = 0;
    this.histBin = 100;
    this.levelHist = new Array(this.histBin); // 音圧レベルのヒストグラムの指数移動平均
    for (let i = 0; i < this.histBin; i++) {
      this.levelHist[i] = 0;
    }

    this.normalizeRate = 1;
    this.maxNormalizeRate = 20;
    this.standard = 0.08; // 基準音圧
    this.thresholdLevel = 0; // 現状の前景音と背景音の間のしきい値
    this.onlyBackground = false;

    // 背景音からbackgroundRange[dB]以内は背景音とみなし、それ以上の値を元に正規化する
    // 小さすぎる音を前景音として誤認するのを防ぐため
    // 大きい方が正規化が安定するが、大きすぎると前景音と背景音の差が小さいケースに対応できない
    this.backgroundRange = 15;

    // デバッグ用
    this.cntUpdate = 0;
    this.cntProcess = 0;
  }
  idxToLevel(idx) {
    return this.histMin + idx * ((this.histMax - this.histMin) / this.histBin);
  }
  levelToIdx(level) {
    return Math.floor(
      Math.max(
        0,
        (level - this.histMin) * (this.histBin / (this.histMax - this.histMin))
      )
    );
  }
  pressureToLevel(pressure) {
    return (20 * Math.log(pressure / 1)) / Math.log(10);
  }
  levelToPressure(level) {
    return 1 * 10 ** (level / 20);
  }
  signalPeak(array) {
    return array.reduce((acc, v) => Math.max(acc, Math.abs(v)));
  }

  // f: (v: number, i: number) => number
  sumHist(f) {
    return this.levelHist.reduce((acc, v, i) => acc + f(v, i), 0);
  }

  // ヒストグラム上で大津の二値化を適用してしきいインデックスを返す
  otsuMethod(hist) {
    let sum1 = 0;
    let sum2 = hist.reduce((acc, v, i) => acc + v * i);
    let size1 = 0;
    let size2 = hist.reduce((acc, v) => acc + v);
    let maxV = -1;
    let ret = -1;
    for (let i = 0; i < hist.length - 1; i++) {
      sum1 += hist[i] * i;
      sum2 -= hist[i] * i;
      size1 += hist[i];
      size2 -= hist[i];
      const t = i + 1;
      const v = size1 * size2 * (sum1 / size1 - sum2 / size2) ** 2;
      if (maxV < v) {
        maxV = v;
        ret = t;
      }
    }
    // if (this.cntUpdate % 10 == 0)
    //   console.log("分離結果", maxV, this.idxToLevel(ret));
    return ret;
  }

  // bufferが溜まりきったときの処理
  update() {
    // bufferのピーク値に基づいて処理をする
    const peak = this.signalPeak(this.buffer);
    if (peak == 0 || this.pressureToLevel(peak) < this.histMin) return; // 完全に無音(ミュート時)は無視
    const peakLevel = this.pressureToLevel(peak);
    const peakIdx = this.levelToIdx(peakLevel);

    // if (this.cntUpdate % 100 == 0) {
    //   console.log("peak", peak);
    // }

    // 背景音しかないとき何も更新したくない
    if (this.onlyBackground && peakLevel <= this.thresholdLevel) {
      // console.log("喋ってねえよ");
      return;
    }

    // 指数移動平均を更新
    for (let i = 0; i < this.histBin; i++) this.levelHist[i] *= 1 - this.a;
    this.levelHist[peakIdx] += 1 * this.a;

    // 前景音と背景音を分ける
    this.thresholdLevel = this.idxToLevel(this.otsuMethod(this.levelHist));

    // 背景音からbackgroundRange[dB]以内は誰がなんと言おうと背景音
    const preBackgroundLevel =
      this.sumHist((v, i) =>
        this.idxToLevel(i) < this.thresholdLevel ? v * this.idxToLevel(i) : 0
      ) /
      this.sumHist((v, i) =>
        this.idxToLevel(i) < this.thresholdLevel ? v : 0
      );
    this.thresholdLevel = Math.max(
      this.thresholdLevel,
      preBackgroundLevel + this.backgroundRange
    );

    // if (this.cntUpdate % 100 == 0) {
    //   console.log(this.thresholdLevel);
    // }

    const foregroundSize = this.sumHist((v, i) =>
      this.thresholdLevel <= this.idxToLevel(i) ? v : 0
    );
    const backgroundSize = this.sumHist((v, i) =>
      this.idxToLevel(i) < this.thresholdLevel ? v : 0
    );
    // 背景音の割合が大きすぎないか調べる
    this.onlyBackground = foregroundSize < backgroundSize * 0.1;

    if (foregroundSize == 0) return; // 以降計算不能なので既存値を使う

    // 前景音レベルの代表値を算出する(現状は平均値)
    const foregroundLevel =
      this.sumHist((v, i) =>
        this.thresholdLevel <= this.idxToLevel(i) ? v * this.idxToLevel(i) : 0
      ) / foregroundSize;
    const foreground = this.levelToPressure(foregroundLevel);

    // if (this.cntUpdate % 100 == 0)
    //   console.log("前景音の大きさ(dBFS peak)", foregroundLevel);

    this.normalizeRate = Math.min(this.standard / foreground, this.maxNormalizeRate);

    // if (this.cntUpdate % 100 == 0) console.log(this.normalizeRate);

    this.cntUpdate++;
  }

  process(inputs, outputs, parameters) {
    if (!(inputs[0] && inputs[0][0])) return true;
    const output = outputs[0][0];
    const input = inputs[0][0];
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.itr] = input[i];
      this.itr++;
      if (this.itr == this.capacity) {
        this.update();
        this.itr = 0;
      }
    }
    for (let i = 0; i < output.length; i++) {
      output[i] = input[i] * this.normalizeRate;
    }

    // if (this.cntProcess % 10 == 0 && this.cntProcess < 500 * 10) {
    //   console.log(
    //     this.pressureToLevel(this.signalPeak(input)),
    //     " -> ",
    //     this.pressureToLevel(this.signalPeak(output))
    //   );
    // }
    this.cntProcess++;
    return true;
  }
}

registerProcessor("foreground-normalizer", ForegroundNormalizer);
