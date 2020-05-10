import { Stream } from "xstream";
import { MainDOMSource, VNode } from "@cycle/dom";
import * as U from "./util";

// DOMSourcesはeventsが上手くいかない https://github.com/cyclejs/cyclejs/issues/916
export type Source = MainDOMSource;
export type Sink = Stream<VNode>;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "DOM";
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
