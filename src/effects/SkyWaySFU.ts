import xs, { Stream } from "xstream";
import fromEvent from "xstream/extra/fromEvent";
import { Component } from "../types";
import * as SkyWay from "skyway-js";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Peer = require("skyway-js");

export type RoomID = string;
function toString(id: RoomID): string {
  return id;
}
function fromString(id: string): RoomID {
  return id;
}
type PeerID = string;

// TODO: 例外処理

export type Connection = {
  peerID: PeerID;
  updateMediaStream$: Stream<MediaStream>;
  json$: Stream<Record<string, unknown>>;
  closing$: Stream<[]>;
};

export type Source = {
  connection$: Stream<Connection>;
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

type MediaStreamWithPeerID = MediaStream & { peerId: PeerID };

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return function (sources: Omit<Sos, Name>): Omit<Sis, Name> {
    const so: Source = { connection$: xs.create() };
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
          room.send(JSON.stringify(json));
        },
      });

      type DataObject = { src: PeerID; data: string };
      const peerLeave$: Stream<PeerID> = fromEvent(room, "peerLeave");
      peerLeave$.subscribe({
        next: (id) => {
          console.log("peerLeave: " + id);
        },
      });
      const peerJoin$: Stream<PeerID> = fromEvent(room, "peerJoin");
      peerJoin$.subscribe({
        next: (id) => {
          console.log("peerJoin: " + id);
        },
      });
      const stream$: Stream<[PeerID, MediaStream]> = fromEvent(room, "stream");
      const data$: Stream<DataObject> = fromEvent(room, "data");
      data$.subscribe({
        next: (d) => {
          console.log("receive data " + d);
        },
      });

      const connection$: Stream<Connection> = peerJoin$.map((peerID) => {
        const ret: Connection = {
          peerID: peerID,
          updateMediaStream$: stream$
            .filter(([id, _]) => id === peerID)
            .map(([_, s]) => s),
          json$: data$.filter((d) => d.src === peerID).map((d) => JSON.parse(d.data)).debug("json"),
          closing$: peerLeave$.filter((id) => id === peerID).mapTo([]),
        };
        return ret;
      });
      connection$.subscribe({
        next: (v) => so.connection$.shamefullySendNext(v),
      });
    }

    const peer = new Peer({
      key: "02cc71f9-6aac-4070-8251-037792b2ed60",
    });
    const room$: Stream<SkyWay.SfuRoom> = xs.create();
    si.join$.subscribe({
      next: (roomID: RoomID) => {
        const strID = toString(roomID);
        room$.shamefullySendNext(peer.joinRoom(strID, { mode: "sfu" }));
      },
    });
    room$.subscribe({ next: withRoom });

    return { ...sinks };
  };
}
