import { ProcOptions, defaultOptions } from "./ForegroundNormalizerParam";
import { AudioWorkletProcessorInterface, Options } from "./types";
import { emaConst, dB2lin, lin2dB, msec2sec, signalRMS } from "./util";
import { toRequired } from "../util";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare function registerProcessor(a: unknown, b: unknown): void;

// 前景音をうまく正規化するAudioWorkletProcessor
// 人が喋っている音声を想定している
class ForegroundNormalizer extends AudioWorkletProcessor
  implements AudioWorkletProcessorInterface {
  readonly param: Required<ProcOptions>;

  readonly capacity = (msec2sec(1) * sampleRate) | 0;
  buffer: number[] = new Array(this.capacity);
  itr = 0;

  // ヒストグラムの半減期(bufferの処理1回で時刻1)
  // 大きいと正規化が寛容的になり小さいと敏感になる
  readonly halfLife: number;

  readonly a: number; // ヒストグラムの平滑化係数
  readonly histMin: number = -100; // 音圧レベルの下限値 [dBFS]
  readonly histMax: number = 0;
  readonly histBin = 200;
  levelHist: number[];

  readonly maxNormalizeRatio = 20;
  normalizeRatio = 1;
  thresholdDB: number = this.histMin;

  // 背景音からbackgroundRange[dB]以内は背景音とみなし、それ以上の値を元に正規化する
  // 小さすぎる音を前景音として誤認するのを防ぐため
  // 大きい方が正規化が安定するが、大きすぎると前景音と背景音の差が小さいケースに対応できない
  readonly backgroundRange = 15;

  // デバッグ用
  cntProcess = 0;
  cntUpdate = 0;

  readonly idx2dB = (idx: number): number =>
    this.histMin + idx * ((this.histMax - this.histMin) / this.histBin);
  readonly dB2Idx = (level: number): number =>
    Math.floor(
      Math.max(
        0,
        (level - this.histMin) * (this.histBin / (this.histMax - this.histMin))
      )
    );
  // map(f) -> sum
  readonly sumHist = (f: (v: number, i: number) => number): number =>
    this.levelHist.reduce((acc, v, i) => acc + f(v, i), 0);

  constructor(options: Options<ProcOptions>) {
    super();

    this.param = toRequired(defaultOptions)(options.processorOptions);

    this.halfLife = (this.param.halfLifeSec * sampleRate) / this.capacity;
    this.a = emaConst(this.halfLife);

    this.levelHist = new Array(this.histBin); // 音圧レベルのヒストグラムの指数移動平均
    for (let i = 0; i < this.histBin; i++) {
      this.levelHist[i] = 0;
    }
  }

  // ヒストグラム上で大津の二値化を適用してしきいインデックスを返す
  otsuMethod(hist: number[]): number {
    let sum1 = 0;
    let sum2 = hist.reduce((acc, v, i) => acc + v * i, 0);
    let size1 = 0;
    let size2 = hist.reduce((acc, v) => acc + v, 0);
    let maxV = -1;
    let ret = -1;
    for (let i = 0; i < hist.length - 1; i++) {
      sum1 += hist[i] * i;
      sum2 -= hist[i] * i;
      size1 += hist[i];
      size2 -= hist[i];
      const t = i + 1;
      let v = size1 * size2 * (sum1 / size1 - sum2 / size2) ** 2;
      if (isNaN(v)) v = 0;
      if (maxV < v) {
        maxV = v;
        ret = t;
      }
    }
    // if (this.cntUpdate % 100 == 0) console.log("分離結果", maxV, ret);
    return ret;
  }

  // bufferが溜まりきったときの処理
  update(): void {
    this.cntUpdate++;

    // bufferの二乗平均を音量とする
    const volume = Math.sqrt(
      this.buffer.reduce((acc, v) => acc + v * v, 0) / this.buffer.length
    );

    if (volume == 0) return; // 完全に無音(ミュート時)は無視
    const volumeDB = lin2dB(volume);
    const volumeIdx = this.dB2Idx(volumeDB);

    // if (this.cntUpdate % 100 == 0) {
    //   console.log("volumeIdx: ", volumeIdx);
    // }

    // 指数移動平均を更新
    for (let i = 0; i < this.histBin; i++) this.levelHist[i] *= 1 - this.a;
    // if (this.cntUpdate % 100 == 0) {
    //   console.log("volumeIdx: ", volumeIdx);
    //   console.log("a: ", this.a);
    // }
    this.levelHist[volumeIdx] += 1 * this.a;

    // 前景音と背景音を分ける
    this.thresholdDB = this.idx2dB(this.otsuMethod(this.levelHist));

    // 背景音からbackgroundRange[dB]以内は誰がなんと言おうと背景音
    const preBackgroundLevel =
      this.sumHist((v, i) =>
        this.idx2dB(i) < this.thresholdDB ? v * this.idx2dB(i) : 0
      ) / this.sumHist((v, i) => (this.idx2dB(i) < this.thresholdDB ? v : 0));
    this.thresholdDB = Math.max(
      this.thresholdDB,
      preBackgroundLevel + this.backgroundRange
    );

    // if (this.cntUpdate % 100 == 0) {
    //   console.log(this.thresholdDB);
    // }

    const foregroundSize = this.sumHist((v, i) =>
      this.thresholdDB <= this.idx2dB(i) ? v : 0
    );
    const backgroundSize = this.sumHist((v, i) =>
      this.idx2dB(i) < this.thresholdDB ? v : 0
    );

    // 背景音の割合が大きいとき正規化係数の更新を避ける
    if (foregroundSize < backgroundSize * 0.1) {
      // console.log("喋ってねえよ");
      return;
    }

    // 前景音レベルの代表値を算出する(現状は平均値)
    const foregroundLevel =
      this.sumHist((v, i) =>
        this.thresholdDB <= this.idx2dB(i) ? v * this.idx2dB(i) : 0
      ) / foregroundSize;
    const foreground = dB2lin(foregroundLevel);

    // if (this.cntUpdate % 100 == 0)
    //   console.log("前景音の大きさ(dBFS)", foregroundLevel);

    const normalizeRatio = dB2lin(this.param.standardDB) / foreground;
    if (!normalizeRatio || isNaN(normalizeRatio) || normalizeRatio <= 0) {
      console.log("warning: 音声の正規化が一時的に失敗");
      return;
    }

    this.normalizeRatio = Math.min(normalizeRatio, this.maxNormalizeRatio);

    // if (this.cntUpdate % 100 == 0) console.log(this.normalizeRate);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
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
      output[i] = input[i] * this.normalizeRatio;
    }

    // if (this.cntProcess % 100 == 0 && this.cntProcess < 500 * 10) {
    //   console.log(lin2dB(signalRMS(input)), " -> ", lin2dB(signalRMS(output)));
    // }
    this.cntProcess++;
    return true;
  }
}

registerProcessor("foreground-normalizer", ForegroundNormalizer);
