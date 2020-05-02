/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

type Func2 = (a1: unknown, a2: unknown) => unknown;
type Func3 = (a1: unknown, a2: unknown, a3: unknown) => unknown;
type Func4 = (a1: unknown, a2: unknown, a3: unknown, a4: unknown) => unknown;
type Func5 = (a1: unknown, a2: unknown, a3: unknown, a4: unknown, a5: unknown) => unknown;
type Func6 = (a1: unknown, a2: unknown, a3: unknown, a4: unknown, a5: unknown, a6: unknown) => unknown;
type Func7 = (a1: unknown, a2: unknown, a3: unknown, a4: unknown, a5: unknown, a6: unknown, a7: unknown) => unknown;

type Curried2 = (a1: unknown) => (a2: unknown) => unknown;
type Curried3 = (a1: unknown) => (a2: unknown) => (a3: unknown) => unknown;
type Curried4 = (a1: unknown) => (a2: unknown) => (a3: unknown) => (a4: unknown) => unknown;
type Curried5 = (a1: unknown) => (a2: unknown) => (a3: unknown) => (a4: unknown) => (a5: unknown) => unknown;
type Curried6 = (a1: unknown) => (a2: unknown) => (a3: unknown) => (a4: unknown) => (a5: unknown) => (a6: unknown) => unknown;
type Curried7 = (a1: unknown) => (a2: unknown) => (a3: unknown) => (a4: unknown) => (a5: unknown) => (a6: unknown) => (a7: unknown) => unknown;

export const curry2: (f: Func2) => Curried2 = f => a1 => a2 => f(a1, a2);
export const curry3: (f: Func3) => Curried3 = f => a1 => a2 => a3 => f(a1, a2, a3);
export const curry4: (f: Func4) => Curried4 = f => a1 => a2 => a3 => a4 => f(a1, a2, a3, a4);
export const curry5: (f: Func5) => Curried5 = f => a1 => a2 => a3 => a4 => a5 => f(a1, a2, a3, a4, a5);
export const curry6: (f: Func6) => Curried6 = f => a1 => a2 => a3 => a4 => a5 => a6 => f(a1, a2, a3, a4, a5, a6);
export const curry7: (f: Func7) => Curried7 = f => a1 => a2 => a3 => a4 => a5 => a6 => a7 => f(a1, a2, a3, a4, a5, a6, a7);
