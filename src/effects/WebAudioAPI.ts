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
import * as CmpExperParam from "../AudioWorkletProcessor/CmpExperParam";
import * as NormalizerParam from "../AudioWorkletProcessor/ForegroundNormalizerParam";

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

export type Source = {
  normalizedVoice$: Stream<Voice>;
};
export type Sink = {
  virtualizeRequest$: U.Streamed<VirtualizeRequest>;
  initContext$: Stream<[]>;
};

// --------------------effectのボイラープレート(コピペする)---------------------------
const name = "WebAudioAPI";
type So = Source;
type Si = Sink;

import { Named } from "./util";
import { tuple } from "../util";
import { CmpExper } from "../AudioWorkletProcessor/CmpExper";
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
    panner.rolloffFactor = 0.88;
    const speakerNode = ctx.createMediaStreamSource(req.voice);

    speakerNode.connect(panner);
    panner.connect(ctx.destination);
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

const initContext = (): Stream<AudioContext> => {
  const ctx = new AudioContext();
  const promises = [
    ctx.audioWorklet.addModule("AudioWorkletProcessor/ForegroundNormalizer.js"),
    ctx.audioWorklet.addModule("AudioWorkletProcessor/CmpExper.js"),
  ];
  return xs.combine(...promises.map((p) => xs.fromPromise(p))).mapTo(ctx);
};

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return (sources) => {
    const source: Source = { normalizedVoice$: xs.create() };
    const sinks = component({ ...sources, ...nameSo(source) } as Sos);
    const sink = getSi(sinks);

    const vRequestSum$ = U.unstreamedSum(sink.virtualizeRequest$);
    const ctx$: Stream<AudioContext> = sink.initContext$
      .map(initContext)
      .flatten();
    const normalizedVoice$ = ctx$
      .map((ctx) =>
        xs
          .fromPromise(
            navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          )
          .map((stream) => {
            console.log(ctx.state);
            const audio = new Audio();
            const src = ctx.createMediaStreamSource(stream);
            const normalizerOptions: NormalizerParam.ProcOptions = {
              standardDB: -10,
              halfLifeSec: 2.5,
            };
            const compressorOptions: CmpExperParam.ProcOptions = {
              ratio: 1 / 4,
              thresholdDB: -10,
              postGainDB: 2,
            };
            const expanderOptions: CmpExperParam.ProcOptions = {
              ratio: 1.65,
              thresholdDB: -130,
              postGainDB: -130 * (1.65 - 1),
            };
            const normalizer = new AudioWorkletNode(
              ctx,
              "foreground-normalizer"
            );
            const compressor = new AudioWorkletNode(ctx, "cmp-exper", {
              processorOptions: compressorOptions,
            });
            const expander = new AudioWorkletNode(ctx, "cmp-exper", {
              processorOptions: expanderOptions,
            });
            const lowcut = ctx.createBiquadFilter();
            lowcut.type = "lowshelf";
            lowcut.frequency.value = 250;
            lowcut.gain.value = -15;
            const dst = ctx.createMediaStreamDestination();

            src.connect(normalizer);
            normalizer.connect(compressor);
            compressor.connect(expander);
            expander.connect(lowcut);
            lowcut.connect(dst);
            console.log("initialized normalizer");
            return dst.stream;
          })
      )
      .flatten();
    virtualize(xs.combine(ctx$, Op.delayUntil(ctx$)(vRequestSum$)));
    normalizedVoice$.subscribe({
      next: (x) => {
        source.normalizedVoice$.shamefullySendNext(x);
      },
    });
    return { ...sinks };
  };
}
