import { Reducer } from "@cycle/state";
import xs, { Stream } from "xstream";

// 使い方:
// const V = tuple('A', 'B');
// すると (typeof V)[number] === 'A' | 'B'
export type Narrowable =
  | string
  | number
  | boolean
  | symbol
  | object
  | {}
  | void
  | null
  | undefined;
export const tuple = <T extends Narrowable[]>(...args: T) => args;

export type Endo<T> = (_: T) => T;
export const toReducerFunc = <T>(s0: T) => (f: Endo<T>): Reducer<T> => {
  return (s): T => (s ? f(s) : s0);
};
export const toReducer = <T>(s0: T) => (
  s: Stream<Endo<T>>
): Stream<Reducer<T>> => s.map(toReducerFunc(s0)).startWith(() => s0);

export type Proxy<T> = "__proxy" | T;
export const proxy = <T>(): Proxy<T> => "__proxy";

// 直和型
// 使い方:
// type A = { str: string };
// type B = { num: number };
// const abDef: Proxy<["A" | "B", { A: A, B: B }]> = proxy();

// const a: A = { str: "hoge" };
// const b: B = { num: 3 };
// const l = [mkSumV(abDef)("A")(a), mkSumV(abDef, "B", b)];
// const pattern = {
//   A: (a: A) => "it's A. value is " + a.str,
//   B: (b: B) => "it's B. value is " + b.num,
// };
// console.log(l.map((v) => match(abDef)(pattern)(v)));
export type SumDef = Record<string, unknown>;
export type Sum<Def extends SumDef> = {
  name: keyof Def;
  value: Def[keyof Def];
};
export const mkSumV = <Def extends SumDef>(proxy: Proxy<Def>) => <
  K extends keyof Def
>(
  name: K
) => (value: Def[K]): Sum<Def> => ({ name: name, value: value });
export const caseOf = <Def extends SumDef>(proxy: Proxy<Def>) => (
  sum: Sum<Def>
) => <A>(pattern: { [K in keyof Def]: (_: Def[K]) => A }): A => {
  console.log("caseOf resolve by ", sum.name);
  return pattern[sum.name](sum.value);
};
export const match = <Def extends SumDef>(proxy: Proxy<Def>) => <A>(
  pattern: { [K in keyof Def]: (_: Def[K]) => A }
) => (sum: Sum<Def>): A => pattern[sum.name](sum.value);

export type Streamed<T extends Record<string, unknown>> = {
  [P in keyof T]: Stream<T[P]>;
};

export function unstreamed<T extends Record<string, unknown>>(
  a: Streamed<T>
): Stream<T> {
  const combined$: Stream<unknown[]> = xs.combine(...Object.values(a));
  const ks: string[] = Object.keys(a);
  const zipped$: Stream<[string, unknown][]> = combined$.map((c) =>
    c.map((v, i) => [ks[i], v] as [string, unknown])
  );
  return zipped$.map(Object.fromEntries);
}

export function unstreamedSum<T extends Record<string, unknown>>(
  a: Streamed<T>
): Stream<Sum<T>> {
  const proxyT: Proxy<T> = proxy();
  const entries = Object.entries(a) as [keyof T, T[keyof T]][];
  const sums: Stream<Sum<T>>[] = entries.map(([k, stream]) => {
    type K = keyof Streamed<T>;
    return (stream as Streamed<T>[K]).map((v) => mkSumV(proxyT)(k)(v));
  });
  return xs.merge(...sums);
}

export const toRequired = <T>(dflt: Required<T>) => (
  p: Partial<T> | undefined
): Required<T> => {
  if (!p) return dflt;
  const entries = Object.entries(dflt) as [keyof T, Required<T>[keyof T]][];
  const ret = entries.map(
    ([k, v]) => [k, p[k] ? p[k] : v] as [keyof T, Required<T>[keyof T]]
  );
  return (Object.fromEntries(ret) as unknown) as Required<T>;
};

// mean 平均
// sd 標準僅差
export const normalDistribution = (sd: number) => (mean: number): number => {
  const x = Math.random();
  const y = Math.random();

  const z1 = Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y);
  // const z2 = Math.sqrt(-2 * Math.log(x)) * Math.sin(2 * Math.PI * y);

  return mean + z1 * sd;
};
