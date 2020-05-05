import xs, { Stream } from "xstream";
import flattenConcurrently from "xstream/extra/flattenConcurrently";
import sampleCombine from "xstream/extra/sampleCombine";
import * as D from "@cycle/dom";
import { Reducer } from "@cycle/state";
import * as Snabbdom from "snabbdom-pragma";
import { Position, Quaternion, Voice, UserData, UserID } from "../types";
import * as DOM from "../effects/DOM";
import * as SkyWay from "../effects/SkyWaySFU";
import * as StateE from "../effects/State";
// import * as UCon from "../effects/UserConnections";
import * as U from "../util";
import { WorldIDInputModal } from "../ui-figma/WorldIDInputModal";
import { isGameData } from "../json-schema/GameData.validator";
import {
  isGameIDNotice,
  GameIDNotice,
} from "../json-schema/GameIDNotice.validator";
import { GameUserIDInputModal } from "../ui-figma/GameUserIDInputModal";

// 状態はなるべく一箇所に固めない
export type State = {
  showingWID: boolean;
  showingGID: boolean;
  userIDs: UserID[];
};

// type SourcesMock = DOM.NamedSo &
//   UCon.NamedSo &
//   /*Game.NamedSo & Audio.NamedSo & */ StateE.NamedSo<State>;
// type SinksMock = DOM.NamedSi &
//   UCon.NamedSi &
//   /*Game.NamedSi & Audio.NamedSi & */ StateE.NamedSi<State>;

type Sources = DOM.NamedSo & SkyWay.NamedSo;
type Sinks = DOM.NamedSi & SkyWay.NamedSi;

function toVoice(mediaStream: MediaStream): Voice {
  return mediaStream;
}

function toUserData(c: SkyWay.Connection): U.Streamed<UserData> {
  return {
    userID: xs.of(c.peerID),
    gameUserID: c.json$.filter(isGameIDNotice).map((g) => g.gameUserID),
    voice: c.updateMediaStream$.map(toVoice),
  };
}

function isNotBottom<T>(a: T | null | undefined): a is T {
  return a != null && a != undefined;
}
function dropBottoms<T>(s: Stream<T | null | undefined>): Stream<T> {
  return s.filter(isNotBottom);
}
function isHTMLInputElement(a: unknown): a is HTMLInputElement {
  return a instanceof HTMLInputElement;
}

function view(s: State): D.VNode {
  const userView: D.VNode[] = s.userIDs.map((id) => <h1>{id}</h1>);
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

export function App(sources: Sources): Sinks {
  const domSo = DOM.getSo(sources);
  const skywaySo = SkyWay.getSo(sources);
  // TODO: ユーザー減った時の処理
  // TODO: 人が入ってきたら毎回ID送る
  // TODO: ゲームデータの入力
  const users$: Stream<U.Streamed<UserData>[]> = skywaySo.connection$.fold(
    (acc: U.Streamed<UserData>[], c) => acc.concat(toUserData(c)),
    []
  ).debug("users");
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
  const uss: Stream<Stream<string>[]> = users$.map((us) =>
    us.map((d) => d.gameUserID)
  ).debug("us");
  const streamedState: U.Streamed<State> = {
    showingWID: doneWID$.mapTo(false).startWith(true),
    showingGID: xs
      .merge(doneWID$.mapTo(true), doneGID$.mapTo(false))
      .startWith(false),
    userIDs: flattenConcurrently(uss.map((l) => xs.combine(...l))).debug("userIds"),
  };
  const state: Stream<State> = U.unstreamed(streamedState).debug("state");
  const domSi: DOM.Sink = state.map(view);
  const skywaySi: SkyWay.Sink = {
    join$: doneWID$.compose(sampleCombine(inputWID$)).map((p) => p[1]),
    sendJSON$: doneGID$
      .compose(sampleCombine(inputGID$))
      .map((p) => p[1])
      .map((gid) => toJSON(gid) as Record<string, unknown>),
  };
  return { ...DOM.nameSi(domSi), ...SkyWay.nameSi(skywaySi) };
}

// export function AppMockInner(sources: SourcesMock): SinksMock {
//   const soUCon = UCon.getSo(sources);
//   const soState = StateE.getSo(sources);
//   const state$ = soState.stream;
//   const addUser$: Stream<U.Endo<State>> = soUCon.map((con) => (s) => ({
//     userList: s.userList.concat(con.userData),
//   }));
//   const removeUser$: Stream<Stream<U.Endo<State>>> = soUCon.map((con) =>
//     con.closing.mapTo((s) => ({
//       userList: s.userList.filter((d) => d.userID != con.userData.userID),
//     }))
//   );
//   const s0 = { userList: [] };
//   const siState = xs
//     .merge(flattenConcurrently(removeUser$), addUser$)
//     .map(U.toReducer<State>(s0));
//   function show(d: UserData): D.VNode {
//     return <h1>{d.gameUserID}</h1>;
//   }
//   //const siDOM = state$.map((s: State) => D.div(s.userList.map(show)));
//   const siDOM = xs.of(WorldIDInputModal(true));
//   const siUCon = xs.of({
//     gameUserID: "winjii",
//     userID: "winjii",
//     voice: {},
//   });
//   return {
//     ...DOM.nameSi(siDOM),
//     ...UCon.nameSi(siUCon),
//     ...StateE.nameSi<State>(siState),
//   };
// }

// export const AppMock = StateE.run<State, SourcesMock, SinksMock>(AppMockInner);

// function makeDriver() {
//     const context = new AudioContext();

//     return function Driver(source$) {
//         context.hogehoge();
//         return sink$;
//     }
// }
