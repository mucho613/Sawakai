import { Stream } from "xstream";
import * as U from "./util";
import { Component, UserID, Voice, Pose, toString } from "../types";
import * as AudioAPI from "../effects/WebAudioAPI";

export type SpeakerID = string;
export function toSpeakerID(userID: UserID): SpeakerID {
  return toString(userID);
}

export type Source = {
  virtualized$: Stream<{ id: SpeakerID; voice: Voice }>;
};
export type Sink = {
  virtualizeInit$: Stream<{ id: SpeakerID; voice: Voice }>;
  virtualizeSpeakerUpdate$: Stream<{ id: SpeakerID; pose: Pose }>;
  virtualizeListenerUpdate$: Stream<Pose>;
};

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "WebAudioAPI";
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
  const ctx = new AudioContext();
  const panners: { [key: string]: PannerNode } = {};
  const listener = ctx.listener;
  return (sources) => {
    // const sources_ = ..;
    // const sinks = component(sources_);
    const sink = getSi(sinks);
    sink.virtualizeInit$.subscribe({
      next: (user) => {
        const speakerNode = ctx.createMediaStreamSource(user.voice);
        const panner = ctx.createPanner();
        panners[user.id] = panner;
        speakerNode.connect(panner);
        panner.connect(ctx.destination);
      },
    });
    sink.virtualizeSpeakerUpdate$.map((spk) => {
      const { pos, faceDir } = spk.pose;
      panners[spk.id].setPosition(pos.x, pos.y, pos.z);
      panners[spk.id].setPosition(faceDir.x, faceDir.y, faceDir.z);
    });
    sink.virtualizeListenerUpdate$.map((lsn) => {
      const { pos, faceDir, headDir } = lsn;
      listener.setPosition(pos.x, pos.y, pos.z);
      listener.setOrientation(
        faceDir.x,
        faceDir.y,
        faceDir.z,
        headDir.x,
        headDir.y,
        headDir.z
      );
    });
    // const sinks_ = ..;
    return sinks_;
  };

  throw new Error("not implemented");
}
