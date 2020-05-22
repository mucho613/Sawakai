export interface AudioWorkletProcessorInterface {
  // 今の所不要
  // readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

export type Options<ProcOptions> = Partial<{
  numberOfInputs: number;
  numberOfOutputs: number;
  outputChannelCount: number[];
  parameterData: Record<string, AudioParam>;
  processorOptions: ProcOptions;
}>;
