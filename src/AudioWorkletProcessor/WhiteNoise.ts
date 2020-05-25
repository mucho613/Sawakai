import { ProcOptions, defaultOptions } from "./WhiteNoiseParam";
import { AudioWorkletProcessorInterface, Options } from "./types";
import { dB2lin } from "./util";
import { toRequired, normalDistribution } from "../util";

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const sampleRate: number;
declare function registerProcessor(a: unknown, b: unknown): void;

export class WhiteNoise extends AudioWorkletProcessor
  implements AudioWorkletProcessorInterface {
  readonly param: Required<ProcOptions>;
  constructor(options: Options<ProcOptions>) {
    super();
    this.param = toRequired(defaultOptions)(options.processorOptions);
  }

  process(_: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0][0];

    for (let i = 0; i < output.length; i++) {
      output[i] = normalDistribution(1)(0);
      output[i] *= dB2lin(this.param.gain);
    }
    return true;
  }
}

registerProcessor("white-noise", WhiteNoise);
