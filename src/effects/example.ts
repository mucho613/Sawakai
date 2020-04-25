type Source = {};
type Sink = {};

// --------------------effectのボイラープレート(コピペする)---------------------------
const name_ = tuple('_Example');
type So = Source;
type Si = Sink;

export type Name = (typeof name_)[number];
export const name = name_[0];
import {Named} from './util';
import {tuple} from '../util';
export type NamedSo = Named<Name, So>;
export type NamedSi = Named<Name, Si>;
export const getSo: <Sos>(sos: Sos & NamedSo) => So = sos => sos[name];
export const getSi: <Sis>(sis: Sis & NamedSi) => Si = sis => sis[name];
export const nameSo: (so: So) => NamedSo = so => { return {[name]: so}; }
export const nameSi: (so: Si) => NamedSi = si => { return {[name]: si}; }
// ---------------------------------------------------------------------------------
