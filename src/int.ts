export type Int = {
  toNum: number;
};

export function int(i: number): Int {
  return { toNum: i | 0 };
}
