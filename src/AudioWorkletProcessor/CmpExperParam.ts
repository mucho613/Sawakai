export type ProcOptions = Partial<{
  thresholdDB: number;
  ratio: number;
  postGainDB: number;
}>;

export const defaultOptions: Required<ProcOptions> = {
  thresholdDB: -15,
  ratio: 1,
  postGainDB: 0,
};
