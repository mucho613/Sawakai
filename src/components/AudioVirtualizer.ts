import { Stream } from "xstream";
import * as AudioAPI from "../effects/WebAudioAPI";
import { Component, UserID, Pose, Voice } from "../types";

type Sources = AudioAPI.NamedSo;
type Sinks = AudioAPI.NamedSi;

export function MakeAudioVirtualizer(
  speaker$: Stream<{ id: UserID; voice: Voice }>,
  speakerData$: Stream<{ id: UserID; pose: Pose }>,
  audioListener$: Stream<Pose>
): Component<Sources, Sinks> {
  return (sources) =>
    AudioVirtualizerInner(speaker$, speakerData$, audioListener$, sources);
}

export function AudioVirtualizerInner(
  speaker$: Stream<{ id: UserID; voice: Voice }>,
  speakerData$: Stream<{ id: UserID; pose: Pose }>,
  audioListener$: Stream<Pose>,
  sources: Sources
): Sinks {
  // Node の接続のモデル こういうかんじで接続したい
  // speakerNode1 => pannerNode1 =\
  // speakerNode2 => pannerNode2 = > destinationNode
  // speakerNode3 => pannerNode3 =/

  // context のメソッドを呼び出して MediaStream を Web Audio API の Node に変換(音源の Node)
  // const speakerNode = ctx.createMediaStreamSource(spk.voice);

  // 音源の Node からの入力に対して、3D音響効果をかける Node を生成する
  // const panner = ctx.createPanner();

  // Node 同士を接続する
  // speakerNode.connect(panner);
  // panner.connect(ctx.destination);

  // type Sources = { 'DOM': DOM.Source, 'Reader': Reader.Source };
  // const sources: Sources;
  // const domSource: DOM.Source = DOM.getSo(sources);

  // const domSink$: DOM.Sink;
  // const sinks$: Sinks = { ...DOM.nameSi(domSink$), ...Reader.nameSi(readerSink$) };
  // type Sinks = { 'DOM': DOM.Sink, 'Reader': Reader.Sink };

  return AudioAPI.nameSi(sink$);
  throw new Error("not implemented");
}
