import { Stream } from "xstream";
import { Component, UserID, Voice, Pose, toString } from "../types";

export type SpeakerID = string;
export function toSpeakerID(userID: UserID): SpeakerID {
  return toString(userID);
}

export type Source = {};
export type Sink = {
  virtualizeAddSpeaker$: Stream<{ id: SpeakerID; voice: Voice }>;
  virtualizeRemoveSpeaker$: Stream<SpeakerID>;
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

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  let ctx: AudioContext | null = null;
  const speakerNodes: { [key: string]: MediaStreamAudioSourceNode } = {};
  const panners: { [key: string]: PannerNode } = {};
  let listener: AudioListener | null = null;
  return (sources) => {
    const source: Source = {};
    const sinks = component({ ...sources, ...nameSo(source) } as Sos);
    const sink = getSi(sinks);
    sink.virtualizeAddSpeaker$.subscribe({
      next: (spk) => {
        if (Object.keys(speakerNodes).length === 0) {
          ctx = new AudioContext();
          listener = ctx.listener;
        }
        if (!ctx || !listener) throw new Error("AudioContext is not ready.");
        if (spk.id in speakerNodes) {
          speakerNodes[spk.id].disconnect();
          delete speakerNodes[spk.id];
          panners[spk.id].disconnect();
          delete panners[spk.id];
        }

        const panner = ctx.createPanner();
        panner.panningModel = "HRTF";
        panner.rolloffFactor = 1.5;
        panners[spk.id] = panner;
        const speakerNode = ctx.createMediaStreamSource(spk.voice);
        speakerNodes[spk.id] = speakerNode;

        speakerNode.connect(panner);
        panner.connect(ctx.destination);
      },
    });
    sink.virtualizeRemoveSpeaker$.subscribe({
      next: (spkId) => {
        if (!ctx || !listener) throw new Error("AudioContext is not ready.");
        speakerNodes[spkId].disconnect();
        delete speakerNodes[spkId];
        panners[spkId].disconnect();
        delete panners[spkId];
      },
    });
    sink.virtualizeSpeakerUpdate$.take(10).debug("speaker data: ");
    sink.virtualizeSpeakerUpdate$.subscribe({
      next: (spk) => {
        if (ctx && panners[spk.id]) {
          const { pos, faceDir } = spk.pose;
          panners[spk.id].setPosition(pos.x, pos.y, pos.z);
          panners[spk.id].setOrientation(faceDir.x, faceDir.y, faceDir.z);
          // console.log("speaker data: ", pos, faceDir);
        }
      },
    });
    sink.virtualizeListenerUpdate$.take(10).debug("listener data: ");
    sink.virtualizeListenerUpdate$.subscribe({
      next: (lsn) => {
        if (ctx && listener) {
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
          // console.log("listener data: ", pos, faceDir, headDir);
        }
      },
    });
    return { ...sinks };
  };
}
