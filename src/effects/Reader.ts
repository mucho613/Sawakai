import * as U from "./util";
import { Component } from "../types";

export type Source<Env> = Env;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "Reader";
type So<Env> = Source<Env>;

import { Named } from "./util";
import { tuple } from "../util";
const name_ = tuple(name);
export type Name = typeof name_[number];
export type NamedSo<Env> = Named<Name, So<Env>>;
export const getSo: <Sos, Env>(sos: Sos & NamedSo<Env>) => So<Env> = (sos) =>
  sos[name];
export const nameSo: <Env>(so: So<Env>) => NamedSo<Env> = (so) => {
  return { [name]: so };
};
// ---------------------------------------------------------------------------------

export function run<Env, Sos extends NamedSo<Env>, Sis>(
  env: Env,
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Sis> {
  return function (sources: Omit<Sos, Name>): Sis {
    // 仕方なくas Sosしている
    // 参照: https://github.com/microsoft/TypeScript/issues/35858
    return component({ ...sources, ...nameSo(env) } as Sos);
  };
}
