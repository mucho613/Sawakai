import {Stream} from 'xstream';
import {StateSource, Reducer, withState} from '@cycle/state';
import {Component} from '../types'
import * as U from './util';

export type Source<State> = StateSource<State>;
export type Sink<State> = Stream<Reducer<State>>;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name_ = tuple('state');
type So<State> = Source<State>;
type Si<State> = Sink<State>;

export type Name = (typeof name_)[number];
export const name = name_[0];
import {Named} from './util';
import {tuple} from '../util';
export type NamedSo<State> = Named<Name, So<State>>;
export type NamedSi<State> = Named<Name, Si<State>>;
export const getSo: <State, Sos>(sos: Sos & NamedSo<State>) => So<State> = sos => sos[name];
export const getSi: <State, Sis>(sis: Sis & NamedSi<State>) => Si<State> = sis => sis[name];
export const nameSo: <State>(so: So<State>) => NamedSo<State> = so => { return {[name]: so}; }
export const nameSi: <State>(so: Si<State>) => NamedSi<State> = si => { return {[name]: si}; }
// ---------------------------------------------------------------------------------

export function run<State, Sos extends NamedSo<State>, Sis extends NamedSi<State>>(
    component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
    return withState<Sos, Sis, State>(component);
}

// interface C { value: number }
// interface A extends C { value: number }
// type B = C & { value: string }

// U.Named<'State', Source<State>> -> { State: Source<State>} 

// Source = { DOM: DOMSource }
// Sink = { DOM: Stream<VNode> }

// Source = { state: StateSource<State> }
// Sink = { state: Stream<Reducer<State>> }

