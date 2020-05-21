import { ProcOptions, defaultOptions } from "./CmpExperParam";
import { AudioWorkletProcessorInterface, Options } from "./types";
import { emaConst, dB2lin, lin2dB, signalPeak } from "./util";
import { toRequired } from "../util";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare function registerProcessor(a: unknown, b: unknown): void;

export class CmpExper extends AudioWorkletProcessor
  implements AudioWorkletProcessorInterface {
  readonly param: Required<ProcOptions>;

  // オフセット除去用の平滑化
  smoothed1 = 0;
  readonly halfLife1: number = sampleRate * (1 / 10);

  // 高周波除去用の平滑化
  smoothed2 = 0;
  readonly halfLife2: number = sampleRate * (1 / 40000);

  gainDB = 0;
  readonly attackHL: number = sampleRate * (1 / 1000);
  readonly releaseHL: number = sampleRate * (10 / 1000);

  cntProcess = 0;

  constructor(options: Options<ProcOptions>) {
    super();
    this.param = toRequired(defaultOptions)(options.processorOptions);
    console.log("CmpExper init!!!!!!!!!!");
    console.log(emaConst(this.halfLife1), emaConst(this.halfLife2));
  }

  readonly desiredGainDB = (lv: number): number => {
    const ts = this.param.thresholdDB;
    if (lv <= ts) return 0;
    return (lv - ts) * this.param.ratio + ts - lv;
  };

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (!(inputs[0] && inputs[0][0])) return true;
    const output = outputs[0][0];
    const input = inputs[0][0];

    // 移動平均(ローパスフィルタ)との差分を取ってオフセットを除く
    // → 振幅を取る
    for (let i = 0; i < input.length; i++) {
      const a = emaConst(this.halfLife1);
      this.smoothed1 = a * input[i] - (1 - a) * this.smoothed1;
      output[i] = input[i] - this.smoothed1;
      output[i] = Math.abs(output[i]);
    }

    // 音量計測のために振幅の高周波成分削る
    for (let i = 0; i < input.length; i++) {
      const a = emaConst(this.halfLife2);
      this.smoothed2 = a * output[i] - (1 - a) * this.smoothed2;
      output[i] = this.smoothed2;
    }

    for (let i = 0; i < input.length; i++) {
      if (output[i] == 0) continue;
      const trgDB = this.desiredGainDB(lin2dB(output[i]));
      const hl =
        Math.abs(this.gainDB) < Math.abs(trgDB)
          ? this.attackHL
          : this.releaseHL;
      const a = emaConst(hl);
      this.gainDB = a * trgDB + (1 - a) * this.gainDB;

      output[i] = input[i] * dB2lin(this.gainDB + this.param.postGainDB);
      // if (this.cntProcess % 100 == 0 && i == 0) {
      //   console.log(
      //     trgDB + this.param.postGainDB,
      //     this.gainDB + this.param.postGainDB,
      //     dB2lin(-200)
      //   );
      // }
    }

    // if (this.cntProcess % 100 == 0) {
    //   console.log(lin2dB(signalPeak(input)), "->", lin2dB(signalPeak(output)));
    // }

    this.cntProcess++;
    return true;
  }
}

registerProcessor("cmp-exper", CmpExper);
