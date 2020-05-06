import xs, { Stream, MemoryStream } from "xstream";
import fromEvent from "xstream/extra/fromEvent";
import { Component } from "../types";
import * as SkyWay from "skyway-js";
import * as Array from "fp-ts/lib/Array";
import * as U from "../util";
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
  updateMediaStream$: Stream<MediaStream>;
  json$: Stream<Record<string, unknown>>;
};

export type Source = {
  connections$: Stream<Connection[]>;
  data$: Stream<[PeerID, Record<string, unknown>]>;
  joinOther$: Stream<PeerID>;
};
export type Sink = {
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

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return function (sources: Omit<Sos, Name>): Omit<Sis, Name> {
    const so: Source = {
      connections$: xs.create<Connection[]>().startWith([]),
      data$: xs.create(),
      joinOther$: xs.create(),
    };
    const sinks: Sis = component({ ...sources, ...nameSo(so) } as Sos);
    const si: Sink = getSi(sinks);

    function withRoom(room: SkyWay.SfuRoom): void {
      const userStream$ = xs.fromPromise(
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      );
      userStream$.subscribe({
        next: (userStream: MediaStream) => {
          room.replaceStream(userStream);
        },
      });
      si.sendJSON$.subscribe({
        next: (json: Record<string, unknown>) => {
          console.log("send JSON: " + json);
          room.send(JSON.stringify(json));
        },
      });

      type DataObject = { src: PeerID; data: string };
      const peerLeave$: Stream<PeerID> = fromEvent(room, "peerLeave");
      const peerJoin$: Stream<PeerID> = fromEvent(room, "peerJoin");
      // 既にいるメンバーのpeerJoinは送られてこないがstreamだけは送られてくる
      const stream$: Stream<SkyWay.RoomStream> = fromEvent(
        room,
        "stream"
      ).remember();
      stream$.subscribe({
        next: (d) => {
          console.log("stream!!!!!!!!!!!!", d);
        },
      });
      const data$: Stream<DataObject> = fromEvent(room, "data").remember();
      data$.subscribe({
        next: (d) => {
          console.log("received", d);
        },
      });

      const endWhenLeave = (id: PeerID) => <T>(s: Stream<T>): Stream<T> =>
        s.endWhen(peerLeave$.filter((x) => x == id));
      const filteredStream = (id: PeerID): Stream<MediaStream> =>
        stream$
          .filter((s) => s.peerId == id)
          .compose(endWhenLeave(id))
          .map((s): MediaStream => s);
      const filteredJson = (id: PeerID): Stream<Record<string, unknown>> =>
        data$
          .filter((d) => d.src == id)
          .map((d) => JSON.parse(d.data))
          .compose(endWhenLeave(id));
      const mkConnection = (peerID: PeerID): Connection => ({
        peerID: peerID,
        updateMediaStream$: filteredStream(peerID),
        json$: filteredJson(peerID),
      });

      type ConDataDef = { joinMaybe: PeerID; leave: PeerID };
      const conDataProxy = U.proxy<ConDataDef>();
      const con$: Stream<U.Sum<ConDataDef>> = xs.merge(
        peerJoin$.map(U.mkSumV(conDataProxy)("joinMaybe")),
        stream$.map((s) => s.peerId).map(U.mkSumV(conDataProxy)("joinMaybe")),
        peerLeave$.map(U.mkSumV(conDataProxy)("leave"))
      );
      const connections$: Stream<Connection[]> = con$.fold(
        (acc: Connection[], v) =>
          U.caseOf(conDataProxy)(v)({
            joinMaybe: (id) =>
              acc.find((c) => c.peerID == id)
                ? acc
                : acc.concat([mkConnection(id)]),
            leave: (id) => acc.filter((c) => id != c.peerID),
          }),
        []
      );

      connections$.subscribe({
        next: (x) => {
          so.connections$.shamefullySendNext(x);
        },
      });
      data$.subscribe({
        next: (d) => so.data$.shamefullySendNext([d.src, JSON.parse(d.data)]),
      });
      peerJoin$.subscribe({
        next: (x) => {
          so.joinOther$.shamefullySendNext(x);
          console.log("peerJoin next", x);
        },
      });
    }

    const peer = new Peer({
      key: "02cc71f9-6aac-4070-8251-037792b2ed60",
    });
    const room$: Stream<SkyWay.SfuRoom> = xs.create();
    si.join$.subscribe({
      next: (roomID: RoomID) => {
        const strID = toString(roomID);
        const room = peer.joinRoom(strID, { mode: "sfu" });
        room$.shamefullySendNext(room);
      },
    });
    room$.subscribe({ next: withRoom });

    return { ...sinks };
  };
}
