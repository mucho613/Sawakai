import xs, { Stream, MemoryStream } from "xstream";
import fromEvent from "xstream/extra/fromEvent";
import { Component } from "../types";
import * as SkyWay from "skyway-js";
import * as Array from "fp-ts/lib/Array";
import * as U from "../util";
import sampleCombine from "xstream/extra/sampleCombine";
import * as Op from "../StreamOperators";
import { Option, some, none, fold, isSome } from "fp-ts/lib/Option";
import * as StateE from "../effects/State";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Peer = require("skyway-js");

export type RoomID = string;
function toString(id: RoomID): string {
  return id;
}
function fromString(id: string): RoomID {
  return id;
}
export type PeerID = string;

// TODO: 例外処理

export type Connection = {
  peerID: PeerID;
  updateMediaStream$: MemoryStream<MediaStream>;
  json$: MemoryStream<Record<string, unknown>>;
};

export type Source = {
  // TODO: joinOtherとかいらないのでは？
  connection$: Stream<Connection>;
  connections$: MemoryStream<Connection[]>;
  data$: Stream<[PeerID, Record<string, unknown>]>;
  stream$: Stream<[PeerID, MediaStream]>;
  joinOther$: Stream<PeerID>;
  leaveOther$: Stream<PeerID>;
};
export type Sink = {
  userStream$: Stream<MediaStream>;
  join$: Stream<RoomID>;
  sendJSON$: Stream<Record<string, unknown>>;
};

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "SkyWaySFU";
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

const onRoom = (room: SkyWay.SfuRoom): Source => {
  type DataObject = { src: PeerID; data: Record<string, unknown> };
  const peerLeave$: Stream<PeerID> = fromEvent(room, "peerLeave").debug(
    "peerLeave"
  );
  const peerJoin$: Stream<PeerID> = fromEvent(room, "peerJoin").debug(
    "peerJoin"
  );
  // 既にいるメンバーのpeerJoinは送られてこないがstreamだけは送られてくる
  const stream$: Stream<[PeerID, MediaStream]> = fromEvent(room, "stream")
    .map<[PeerID, MediaStream]>((s: SkyWay.RoomStream) => [s.peerId, s])
    .debug("stream!!!!!!!!!!!!!");
  const data$: Stream<[PeerID, Record<string, unknown>]> = fromEvent(
    room,
    "data"
  ).map((d: SkyWay.RoomData) => [d.src, d.data]);
  data$.subscribe({
    next: (d) => {
      console.log("received", d);
    },
  });

  const endWhenLeave = (id: PeerID) => <T>(s: Stream<T>): Stream<T> =>
    s.endWhen(peerLeave$.filter((x) => x == id));
  const filteredStream = (id: PeerID): Stream<MediaStream> =>
    stream$
      .filter((s) => s[0] == id)
      .map((s) => s[1])
      .compose(endWhenLeave(id))
      .map((s): MediaStream => s);
  const filteredJson = (id: PeerID): Stream<Record<string, unknown>> =>
    data$
      .filter((d) => d[0] == id)
      .map((d) => d[1])
      .compose(endWhenLeave(id));
  const mkConnection = (peerID: PeerID) => (
    stream0: Option<MediaStream>
  ): Connection => ({
    peerID: peerID,
    updateMediaStream$: fold(
      () => filteredStream(peerID),
      (s: MediaStream) => filteredStream(peerID).startWith(s)
    )(stream0),
    json$: filteredJson(peerID),
  });

  type ConDataDef = {
    join: PeerID;
    joinWithStream: [PeerID, MediaStream];
    leave: PeerID;
  };
  // const mkJoin = (x: PeerID) => U.mkSumV(conDataProxy)("join")(x);
  // const mkJoinWS = (x: [PeerID, MediaStream]) =>
  //   U.mkSumV(conDataProxy)("joinWithStream")(x);
  // const mkLeave = (x: PeerID) => U.mkSumV(conDataProxy)("leave")(x);
  const conDataProxy = U.proxy<ConDataDef>();
  const rawCon$: Stream<U.Sum<ConDataDef>> = xs
    .merge(
      peerJoin$.map(U.mkSumV(conDataProxy)("join")),
      stream$.map(U.mkSumV(conDataProxy)("joinWithStream")),
      peerLeave$.map(U.mkSumV(conDataProxy)("leave"))
    )
    .debug("rawCon$");

  const res$ = rawCon$.fold<[Option<Connection>, Connection[]]>(
    ([_, s], v) =>
      U.caseOf(conDataProxy)(v)({
        join: (id) => {
          const con = mkConnection(id)(none);
          return s.find((c) => c.peerID == id)
            ? [none, s]
            : [some(con), s.concat([con])];
        },
        joinWithStream: ([id, stream]) => {
          const con = mkConnection(id)(some(stream));
          return s.find((c) => c.peerID == id)
            ? [none, s]
            : [some(con), s.concat([con])];
        },
        leave: (id) =>
          s.find((c) => c.peerID == id)
            ? [none, s.filter((c) => id != c.peerID)]
            : [none, s],
      }),
    [none, []]
  );
  const connection$ = res$
    .map((x) => x[0])
    .filter(isSome)
    .map((s) => s.value)
    .debug("connection$");
  const connections$ = res$.map((x) => x[1]).debug("connections");

  return {
    connection$: connection$,
    connections$: connections$,
    data$: data$,
    stream$: stream$,
    joinOther$: peerJoin$,
    leaveOther$: peerLeave$,
  };
};

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return function (sources: Omit<Sos, Name>): Omit<Sis, Name> {
    const so: Source = {
      connection$: xs.create(),
      connections$: xs.create<Connection[]>().startWith([]),
      data$: xs.create(),
      stream$: xs.create(),
      joinOther$: xs.create(),
      leaveOther$: xs.create(),
    };
    const sinks: Sis = component({ ...sources, ...nameSo(so) } as Sos);
    const si: Sink = getSi(sinks);

    const peer = new Peer({
      key: "02cc71f9-6aac-4070-8251-037792b2ed60",
    });

    const room$: Stream<SkyWay.SfuRoom> = xs
      .combine(si.userStream$, si.join$)
      .map(([stream, roomID]) => {
        const strID = toString(roomID);
        return peer.joinRoom(strID, { mode: "sfu", stream: stream });
      });

    si.sendJSON$.subscribe({
      next: (x) => {
        console.log("sendJSON$: ", x);
      },
    });
    xs.combine(room$, Op.delayUntil(room$)(si.sendJSON$)).subscribe({
      next: ([room, data]) => {
        console.log("delayed sendJSON$: ", data);
        room.send(data);
      },
    });
    const so$ = room$.map(onRoom);
    // TODO: 以下のコード群もっと上手く書けるようにutil整備する
    so$
      .map((s) => s.connection$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.connection$.shamefullySendNext(x);
        },
      });
    so$
      .map((s) => s.connections$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.connections$.shamefullySendNext(x);
        },
      });
    so$
      .map((s) => s.data$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.data$.shamefullySendNext(x);
        },
      });
    so$
      .map((s) => s.stream$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.stream$.shamefullySendNext(x);
        },
      });
    so$
      .map((s) => s.joinOther$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.joinOther$.shamefullySendNext(x);
        },
      });
    so$
      .map((s) => s.leaveOther$)
      .flatten()
      .subscribe({
        next: (x) => {
          so.leaveOther$.shamefullySendNext(x);
        },
      });

    return { ...sinks };
  };
}
