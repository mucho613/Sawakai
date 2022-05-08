export type ProcOptions = Partial<{
  gain: number;
}>;

export const defaultOptions: Required<ProcOptions> = {
  gain: 0,
};
