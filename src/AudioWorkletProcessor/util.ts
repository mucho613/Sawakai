export const lin2dB = (x: number): number => {
  return (20 * Math.log(Math.abs(x) / 1)) / Math.log(10);
};
export const dB2lin = (x: number): number => {
  return 1 * 10 ** (x / 20);
};
export const msec2sec = (x: number): number => x / 1000;
export const signalPeak = (array: Float32Array | number[]): number => {
  if (array instanceof Float32Array) {
    return array.reduce((acc, v) => Math.max(acc, Math.abs(v)));
  }
  return array.reduce((acc, v) => Math.max(acc, Math.abs(v)));
};
export const signalRMS = (array: Float32Array | number[]): number => {
  if (array instanceof Float32Array) {
    return Math.sqrt(array.reduce((acc, v) => acc + v * v) / array.length);
  }
  return Math.sqrt(array.reduce((acc, v) => acc + v * v) / array.length);
};

export const emaConst = (halfLife: number): number => {
  return 1 - 2 ** (-1 / halfLife);
};
