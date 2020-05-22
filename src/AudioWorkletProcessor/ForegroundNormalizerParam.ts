export type ProcOptions = Partial<{
  standardDB: number;
  halfLifeSec: number;
}>;

export const defaultOptions: Required<ProcOptions> = {
  standardDB: -10,
  halfLifeSec: 1,
};
