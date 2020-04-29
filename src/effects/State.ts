import { Stream } from "xstream";
import { StateSource, Reducer, withState } from "@cycle/state";
import { Component } from "../types";
import * as U from "./util";

export type Source<State> = StateSource<State>;
export type Sink<State> = Stream<Reducer<State>>;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "State";
type So<State> = Source<State>;
type Si<State> = Sink<State>;

import { Named } from "./util";
import { tuple } from "../util";
const name_ = tuple(name);
export type Name = typeof name_[number];
export type NamedSo<State> = Named<Name, So<State>>;
export type NamedSi<State> = Named<Name, Si<State>>;
export const getSo: <Sos, State>(sos: Sos & NamedSo<State>) => So<State> = (
  sos
) => sos[name];
export const getSi: <Sis, State>(sis: Sis & NamedSi<State>) => Si<State> = (
  sis
) => sis[name];
export const nameSo: <State>(so: So<State>) => NamedSo<State> = (so) => {
  return { [name]: so };
};
export const nameSi: <State>(so: Si<State>) => NamedSi<State> = (si) => {
  return { [name]: si };
};
// ---------------------------------------------------------------------------------

export function run<
  State,
  Sos extends NamedSo<State>,
  Sis extends NamedSi<State>
>(component: Component<Sos, Sis>): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return withState<Sos, Sis, State, Name>(component, name);
}
