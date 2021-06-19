import xs, { Stream } from "xstream";
import { Component, UserID, Voice, Pose, toString } from "../types";
import * as U from "../util";
import * as Op from "../StreamOperators";
import * as ArrayLib from "fp-ts/lib/Array";
import * as StateE from "./State";
import * as CmpExperParam from "../AudioWorkletProcessor/CmpExperParam";
import * as NormalizerParam from "../AudioWorkletProcessor/ForegroundNormalizerParam";
import * as WhiteNoiseParam from "../AudioWorkletProcessor/WhiteNoiseParam";

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

// 周期1の信号sを周波数と初期位相をずらして足し合わせることでランダムっぽい振動を作る
// sは0~1で定義すれば自動で周期化される
// 典型的には s(x) = sin(2*pi*x)
const randomVibration = (fs: number[]) => (p0s: number[]) => (
  s: (t: number) => number
) => (t: number): number => {
  const perioded = (t: number): number => s(t - Math.floor(t));
  return ArrayLib.zipWith(fs, p0s, (f, p) => perioded(f * t + p)).reduce(
    (acc, x) => acc + x
  );
};

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
    ctx.audioWorklet.addModule("AudioWorkletProcessor/WhiteNoise.js"),
  ];
  return xs.combine(...promises.map((p) => xs.fromPromise(p))).mapTo(ctx);
};

const groundNoise = (ctx: AudioContext): AudioNode => {
  const whiteNoiseOptions: WhiteNoiseParam.ProcOptions = {
    gain: 10,
  };
  const whiteNoise = new AudioWorkletNode(ctx, "white-noise", {
    processorOptions: whiteNoiseOptions,
  });
  const fl = 200;
  const fr = 800;
  const decay = ctx.createBiquadFilter();
  decay.type = "bandpass";
  decay.frequency.value = 20;
  decay.Q.value = 7.5;
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 400;
  highShelf.gain.value = -15;
  const lowshelf = ctx.createBiquadFilter();
  lowshelf.type = "lowshelf";
  lowshelf.frequency.value = 25;
  lowshelf.gain.value = -40;
  const delay = ctx.createDelay();
  delay.delayTime.value = 1;
  const peaking = ctx.createBiquadFilter();
  peaking.type = "peaking";
  peaking.frequency.value = fl;
  peaking.gain.value = 0;
  peaking.Q.value = 1;

  const genGain = () => {
    const periods = [5, 9, 17, 31, 67];
    const fs = periods.map((x) => 1 / x);
    const p0s = fs.map(() => Math.random());
    const gain$ = xs
      .periodic(3000)
      .map((t) => randomVibration(fs)(p0s)((t) => Math.sin(t) - 0.5)(t * 3))
      .map((x) => Math.max(0, x * 35));
    return gain$;
  };
  const gain$ = genGain();
  gain$.subscribe({
    next: (g) => {
      // console.log("gain: ", g);
      peaking.gain.linearRampToValueAtTime(g, ctx.currentTime + 3);
    },
  });
  const genFreq = () => {
    const periods = [31, 47, 73, 97];
    const fs = periods.map((x) => 1 / x);
    const p0s = fs.map(() => Math.random());
    const freq$ = xs
      .periodic(3000)
      .map((t) => randomVibration(fs)(p0s)((t) => Math.sin(t) - 0.5)(t * 3))
      .map((x) => fl * Math.exp(Math.log(fr / fl) * (x + 1)));
    return freq$;
  };
  const freq$ = genFreq();
  freq$.subscribe({
    next: (f) => {
      // console.log("frequency", f);
      peaking.frequency.exponentialRampToValueAtTime(f, ctx.currentTime + 3);
    },
  });

  whiteNoise.connect(decay);
  decay.connect(highShelf);
  highShelf.connect(lowshelf);
  lowshelf.connect(peaking);
  peaking.connect(delay);
  return delay;
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
    ctx$.subscribe({
      next: (ctx) => {
        const gn = groundNoise(ctx);
        gn.connect(ctx.destination);
      },
    });
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
