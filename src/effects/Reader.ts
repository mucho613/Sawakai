import * as U from './util';
import { Component } from '../types';

export type Source<Env> = Env;


// --------------------effectのボイラープレート(コピペする)---------------------------
const name_ = tuple('Reader');
type So<Env> = Source<Env>;

export type Name = (typeof name_)[number];
export const name = name_[0];
import {Named} from './util';
import {tuple} from '../util';
export type NamedSo<Env> = Named<Name, So<Env>>;
export const getSo: <Env, Sos>(sos: Sos & NamedSo<Env>) => So<Env> = sos => sos[name];
export const nameSo: <Env>(so: So<Env>) => NamedSo<Env> = so => { return {[name]: so}; }
// ---------------------------------------------------------------------------------


export function run<Env, Sos extends NamedSo<Env>, Sis>(
    env: Env,
    component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Sis> {
    return sources => {
        // 仕方なくas Sosしている
        // 参照: https://github.com/microsoft/TypeScript/issues/35858
        return component({ ...sources, [name]: env } as Sos);
    };
}
