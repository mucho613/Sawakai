import xs, { Stream, MemoryStream } from "xstream";
import flattenConcurrently from "xstream/extra/flattenConcurrently";
import sampleCombine from "xstream/extra/sampleCombine";
import * as D from "@cycle/dom";
import { Reducer } from "@cycle/state";
import * as Snabbdom from "snabbdom-pragma";
import * as T from "../types";
import * as DOM from "../effects/DOM";
import * as SkyWay from "../effects/SkyWaySFU";
import * as StateE from "../effects/State";
// import * as UCon from "../effects/UserConnections";
import * as U from "../util";
import { WorldIDInputModal } from "../ui-figma/WorldIDInputModal";
import { isGameData, GameData } from "../json-schema/GameData.validator";
import {
  isGameIDNotice,
  GameIDNotice,
} from "../json-schema/GameIDNotice.validator";
import { GameUserIDInputModal } from "../ui-figma/GameUserIDInputModal";
import * as AudioAPI from "../effects/WebAudioAPI";
import tween from "xstream/extra/tween";

// 状態はなるべく一箇所に固めない
export type State = {
  showingWID: boolean;
  showingGID: boolean;
  userIDs: T.UserID[];
  streams: MediaStream[];
};

// type SourcesMock = DOM.NamedSo &
//   UCon.NamedSo &
//   /*Game.NamedSo & Audio.NamedSo & */ StateE.NamedSo<State>;
// type SinksMock = DOM.NamedSi &
//   UCon.NamedSi &
//   /*Game.NamedSi & Audio.NamedSi & */ StateE.NamedSi<State>;

type Sources = DOM.NamedSo & SkyWay.NamedSo & AudioAPI.NamedSo;
type Sinks = DOM.NamedSi & SkyWay.NamedSi & AudioAPI.NamedSi;

function toVoice(mediaStream: MediaStream): T.Voice {
  return mediaStream;
}

function isNotBottom<T>(a: T | null | undefined | never): a is T {
  return a != null && a != undefined;
}
function dropBottoms<T>(s: Stream<T | null | undefined | never>): Stream<T> {
  return s.filter(isNotBottom);
}
function isHTMLInputElement(a: unknown): a is HTMLInputElement {
  return a instanceof HTMLInputElement;
}

function view(s: State): D.VNode {
  const userView: D.VNode[] = s.userIDs.map((id) => <h1>{id}</h1>);
  // const audios = s.streams.
  return (
    <div>
      {userView}
      {WorldIDInputModal(s.showingWID)}
      {GameUserIDInputModal(s.showingGID)}
    </div>
  );
}

function toJSON(gid: string): GameIDNotice {
  return {
    gameUserID: gid,
  };
}

function shamefullySendGameMock(s: Stream<GameData>): void {
  const t$ = xs.periodic(100).map((x) => x * (100 / 1000));
  const theta$ = t$.map((t) => (Math.PI * 2 * t) / 5);
  theta$.subscribe({
    next: (t) => {
      s.shamefullySendNext({
        gameUserID: "listener",
        gameClientID: "minecraft",
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
        faceDirection: {
          x: Math.cos(t),
          y: Math.sin(t),
          z: 0,
        },
        upDirection: {
          x: 0,
          y: 0,
          z: 1,
        },
      });
    },
  });

  setInterval(() => {
    s.shamefullySendNext({
      gameUserID: "listener",
      gameClientID: "minecraft",
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      faceDirection: {
        x: 0,
        y: 1,
        z: 0,
      },
      upDirection: {
        x: 0,
        y: 0,
        z: 1,
      },
    });
  }, 1000);
  setInterval(() => {
    s.shamefullySendNext({
      gameUserID: "speaker",
      gameClientID: "minecraft",
      position: {
        x: 1,
        y: 0,
        z: 0,
      },
      faceDirection: {
        x: 0,
        y: -1,
        z: 0,
      },
      upDirection: {
        x: 0,
        y: 0,
        z: 1,
      },
    });
  }, 1000);
}

export function App(sources: Sources): Sinks {
  const domSo = DOM.getSo(sources);
  const skywaySo = SkyWay.getSo(sources);
  const gameData$: Stream<GameData> = skywaySo.data$
    .map(([_, d]) => d)
    .filter(isGameData);
  // shamefullySendGameMock(gameData$);
  gameData$.take(10).subscribe({
    next: (x) => {
      console.log("gameData$: ", x);
    },
  });

  type UserData = {
    gameUserID: string;
    voice: T.Voice;
  };
  const convUD = (debug: string) => (
    c: SkyWay.Connection
  ): [SkyWay.PeerID, U.Streamed<UserData>] => [
    c.peerID,
    {
      gameUserID: c.json$.filter(isGameIDNotice).map((d) => d.gameUserID),
      voice: c.updateMediaStream$.debug(debug),
    },
  ];
  const user$: Stream<[
    SkyWay.PeerID,
    U.Streamed<UserData>
  ]> = skywaySo.connection$.map(convUD("each gameUserID stream")).debug("user");
  const userList$: Stream<
    [SkyWay.PeerID, U.Streamed<UserData>][]
  > = skywaySo.connections$.map((l) => l.map(convUD("")));
  const _userIDs$: Stream<Stream<T.GameUserID>[]> = userList$.map((l) =>
    l.map((d) => d[1].gameUserID)
  );
  const userIDs$: Stream<T.GameUserID[]> = flattenConcurrently(
    _userIDs$.map((l) => xs.combine(...l))
  );
  const doneWID$ = domSo
    .select("#world-id-input-modal .go-button button")
    .events("click");
  const showingWID$: Stream<boolean> = doneWID$.mapTo(false).startWith(true);
  const doneGID$ = domSo
    .select("#game-user-id-input-modal .go-button button")
    .events("click");
  const showingGID$: Stream<boolean> = xs
    .merge(doneWID$.mapTo(true), doneGID$.mapTo(false))
    .startWith(false);
  const inputWID$ = domSo
    .select("#world-id-input-modal input")
    .events("input")
    .map((e) => e.target)
    .filter(isHTMLInputElement)
    .map((t) => t.value);
  const inputGID$ = domSo
    .select("#game-user-id-input-modal input")
    .events("input")
    .map((e) => e.target)
    .filter(isHTMLInputElement)
    .map((t) => t.value);
  const streamedState: U.Streamed<State> = {
    showingWID: showingWID$,
    showingGID: showingGID$,
    userIDs: userIDs$,
    streams: flattenConcurrently(
      userList$.map((l) => xs.combine(...l.map(([_, ud]) => ud.voice)))
    ),
  };
  const sample = <S,>(sampler: Stream<S>) => <T,>(data: Stream<T>): Stream<T> =>
    sampleCombine(data)(sampler).map(([_, d]) => d);
  const myWID$ = sample(doneWID$)(inputWID$);
  const myGID$ = sample(doneGID$)(inputGID$);
  const state: Stream<State> = U.unstreamed(streamedState);
  const domSi: DOM.Sink = state.map(view);
  const skywaySi: SkyWay.Sink = {
    join$: myWID$,
    sendJSON$: xs
      .merge(sample(skywaySo.joinOther$)(myGID$), myGID$)
      .map((gid) => toJSON(gid) as Record<string, unknown>),
  };
  const addSpeaker$ = flattenConcurrently(
    user$.map(([_, d]) =>
      xs
        .combine(d.gameUserID, d.voice)
        .map(([gid, voice]) => ({ id: gid, voice: voice }))
    )
  );
  addSpeaker$.subscribe({
    next: (x) => {
      console.log("aaaaaaaaaaaaaaaa", x);
    },
  });

  xs.combine(gameData$, myGID$)
    .take(10)
    .subscribe({
      next: (x) => {
        console.log("combined gameData: ", x);
      },
    });
  const audioSi: AudioAPI.Sink = {
    virtualizeAddSpeaker$: addSpeaker$.debug("add speaker"),
    virtualizeRemoveSpeaker$: user$
      .map(([_, d]) => d.gameUserID.last())
      .flatten()
      .debug("remove speaker"),
    virtualizeListenerUpdate$: xs
      .combine(gameData$, myGID$)
      // .debug("combined gameData")
      .filter(([gd, id]) => gd.gameUserID === id)
      .map(([gd, _]) => gd)
      .map((gd) => ({
        faceDir: gd.faceDirection,
        headDir: gd.upDirection,
        pos: gd.position,
      })),
    // .debug("update listener position"),
    virtualizeSpeakerUpdate$: xs
      .combine(gameData$, myGID$)
      .filter(([gd, id]) => gd.gameUserID !== id)
      .map(([gd, _]) => gd)
      .map((gd) => ({
        id: gd.gameUserID,
        pose: {
          faceDir: gd.faceDirection,
          headDir: gd.upDirection,
          pos: gd.position,
        },
      })),
    // .debug("update speaker position"),
  };

  // 副作用!!!!
  // const audioElem = domSo.select("audio").element();
  // sampleCombine(audioElem)(addSpeaker$.map((o) => o.voice)).subscribe({
  //   next: ([s, e]) => {
  //     (e as HTMLAudioElement).srcObject = s;
  //     console.log("add audio!!!!!!!!!");
  //   },
  // });
  // --------------------

  return {
    ...DOM.nameSi(domSi),
    ...SkyWay.nameSi(skywaySi),
    ...AudioAPI.nameSi(audioSi),
  };
}
