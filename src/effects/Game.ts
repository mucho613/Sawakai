import xs, { Stream } from 'xstream';
import { GameData, Component, Env } from '../types';
import * as U from './util';
import * as Reader from './Reader';

export type Source = Stream<GameData>;
export type Sink = {};

// --------------------effectのボイラープレート(コピペする)---------------------------
const name_ = tuple('Game');
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

export function run<So extends NamedSo, Si extends NamedSi>(
    component: Component<So, Si>
): Component<Omit<So, Name>, Omit<Si, Name>> {
    throw new Error("not implemented");
}

export function runMock<So extends NamedSo, Si extends NamedSi>(
    component: Component<So, Si>
): Component<Omit<So, Name>, Omit<Si, Name>> {
    throw new Error("not implemented");
}
