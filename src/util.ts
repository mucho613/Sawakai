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
export const toReducer: <T>(s0: T) => (f: Endo<T>) => Reducer<T> = (s0) => (
  f
) => {
  return (s) => {
    if (s == undefined) return s0;
    else return f(s);
  };
};

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
) => <A>(pattern: { [K in keyof Def]: (_: Def[K]) => A }): A =>
  pattern[sum.name](sum.value);
export const match = <Def extends SumDef>(proxy: Proxy<Def>) => <A>(
  pattern: { [K in keyof Def]: (_: Def[K]) => A }
) => (sum: Sum<Def>): A => pattern[sum.name](sum.value);
