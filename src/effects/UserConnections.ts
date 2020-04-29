import xs, { Stream, Listener, Producer } from "xstream";
import { UserData, Component } from "../types";
import * as U from "./util";

export type Connection = {
  closing: Stream<void>;
  userData: UserData;
};

export type Source = Stream<Connection>;
export type Sink = Stream<UserData>;

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "UserConnections";
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

const conMock: Connection[] = [
  {
    closing: xs.never(),
    userData: {
      minecraftID: "mucho613",
      userID: "mucho613",
      voice: {},
    },
  },
  {
    closing: xs.never(),
    userData: {
      minecraftID: "gedorinku",
      userID: "gedorinku",
      voice: {},
    },
  },
];

export function runMock<So extends NamedSo, Si extends NamedSi>(
  component: Component<So, Si>
): Component<Omit<So, Name>, Omit<Si, Name>> {
  return (sources) => {
    const sendMock = (listener: Listener<Connection>, con: Connection) =>
      listener.next(con);
    let id: number;
    const producer: Producer<Connection> = {
      start: (listener: Listener<Connection>) =>
        (id = window.setInterval(() => {
          setTimeout(() => sendMock(listener, conMock[0]), 2000);
          setTimeout(() => sendMock(listener, conMock[1]), 4000);
          setTimeout(
            () => conMock[0].closing.shamefullySendNext(undefined),
            6000
          );
          setTimeout(
            () => conMock[1].closing.shamefullySendNext(undefined),
            8000
          );
        }, 8000)),
      stop: () => window.clearInterval(id),
    };
    const soUCon: Source = xs.create(producer);
    const sinks = component({ ...sources, ...nameSo(soUCon) } as So);
    return { ...sinks }; //siUConはとりあえず捨てる
  };
}
