import { Reducer } from "@cycle/state";

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
