import xs, { Stream } from "xstream";
import { Component, UserID, Voice, Pose, toString } from "../types";
import * as U from "../util";
import buffer from "xstream/extra/buffer";
import concat from "xstream/extra/concat";
import flattenSequentially from "xstream/extra/flattenSequentially";
import split from "xstream/extra/split";
import sampleCombine from "xstream/extra/sampleCombine";
import { Option, some, none } from "fp-ts/lib/Option";
import * as Op from "../StreamOperators";
import * as StateE from "./State";

export type SpeakerID = string;
export function toSpeakerID(userID: UserID): SpeakerID {
  return toString(userID);
}

export type VirtualizeRequest = {
  addSpeaker: { id: SpeakerID; voice: Voice };
  removeSpeaker: SpeakerID;
  updateSpeaker: { id: SpeakerID; pose: Pose };
  updateListener: Pose;
};

export type Source = {};
export type Sink = {
  virtualizeRequest: U.Streamed<VirtualizeRequest>;
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

const virtualize = (
  stream$: Stream<[AudioContext, U.Sum<VirtualizeRequest>]>
): void => {
  console.log("virtualize!!!!!!!!");
  type State = {
    id: SpeakerID;
    node: MediaStreamAudioSourceNode;
    panner: PannerNode;
  }[];
  const state0: State = [];

  const addSpeaker = (ctx: AudioContext) => (
    req: VirtualizeRequest["addSpeaker"]
  ): U.Endo<State> => (s) => {
    console.log("add speaker");
    const spk = s.find((d) => d.id == req.id);
    if (spk) return s;
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.rolloffFactor = 1.5;
    const speakerNode = ctx.createMediaStreamSource(req.voice);

    speakerNode.connect(ctx.destination);
    // speakerNode.connect(panner);
    // panner.connect(ctx.destination);
    return s.concat([
      {
        id: req.id,
        node: speakerNode,
        panner: panner,
      },
    ]);
  };

  const removeSpeaker = (ctx: AudioContext) => (
    id: SpeakerID
  ): U.Endo<State> => (s) => {
    console.log("remove speaker");
    const spk = s.find((d) => d.id == id);
    if (!spk) return s;
    spk.node.disconnect();
    spk.panner.disconnect();
    return s.filter((d) => d.id != id);
  };

  const updateSpeaker = (ctx: AudioContext) => (
    req: VirtualizeRequest["updateSpeaker"]
  ): U.Endo<State> => (s) => {
    const spk = s.find((d) => d.id == req.id);
    if (spk) {
      const { pos, faceDir } = req.pose;
      spk.panner.setPosition(pos.x, pos.y, pos.z);
      spk.panner.setOrientation(faceDir.x, faceDir.y, faceDir.z);
    }
    return s;
  };

  const updateListener = (ctx: AudioContext) => (
    req: VirtualizeRequest["updateListener"]
  ): U.Endo<State> => (s) => {
    const { pos, faceDir, headDir } = req;
    ctx.listener.setPosition(pos.x, pos.y, pos.z);
    ctx.listener.setOrientation(
      faceDir.x,
      faceDir.y,
      faceDir.z,
      headDir.x,
      headDir.y,
      headDir.z
    );
    return s;
  };

  StateE.runSimple<State>((stateSo) => {
    stateSo.stream.subscribe({
      next: (s) => {
        console.log("state!!!", s);
      },
    });
    console.log("debug!!!!!!!!!!!!!!");
    const endo$ = stream$.debug("vRequestSum$ 3").map(([ctx, req]) =>
      U.caseOf(U.proxy<VirtualizeRequest>())(req)<U.Endo<State>>({
        addSpeaker: addSpeaker(ctx),
        removeSpeaker: removeSpeaker(ctx),
        updateListener: updateListener(ctx),
        updateSpeaker: updateSpeaker(ctx),
      })
    );
    const reducer$ = U.toReducer(state0)(endo$);
    reducer$.subscribe({
      next: (x) => {
        console.log("reducer!!!!: ", x);
      },
    });
    return reducer$;
  });
};

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return (sources) => {
    const source: Source = {};
    const sinks = component({ ...sources, ...nameSo(source) } as Sos);
    const sink = getSi(sinks);

    const vRequestSum$ = U.unstreamedSum(sink.virtualizeRequest);
    const ctx$: Stream<AudioContext> = vRequestSum$.map(
      () => new AudioContext()
    );
    virtualize(xs.combine(ctx$, vRequestSum$));
    return { ...sinks };
  };
}
