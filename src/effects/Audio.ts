import { Stream } from "xstream";
import * as U from "./util";
import { Component } from "../types";

export type Source = MediaStream;
export type Sink = MediaStream;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "Audio";
type So = Source;
type Si = Sink;

import { Named } from "./util";
import { tuple } from "../util";
const name_ = tuple(name);
export type Name = typeof name_[number];
export type NamedSo = Named<Name, So>;
export type NamedSi = Named<Name, Si>;
export const getSo: <Sos>(sos: Sos & NamedSo) => So = (sos) => sos[name];
export const getSi: <Sis>(sis: Sis & NamedSi) => Si = (sis) => sis[name];
export const nameSo: (so: So) => NamedSo = (so) => {
  return { [name]: so };
};
export const nameSi: (so: Si) => NamedSi = (si) => {
  return { [name]: si };
};
// ---------------------------------------------------------------------------------

export function run<So extends NamedSo, Si extends NamedSi>(
  component: Component<So, Si>
): Component<Omit<So, Name>, Omit<Si, Name>> {
  throw new Error("not implemented");
}
