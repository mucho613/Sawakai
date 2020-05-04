import xs, { Stream } from "xstream";
import flattenConcurrently from "xstream/extra/flattenConcurrently";
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
import { isGameIDNotice } from "../json-schema/GameIDNotice.validator";
import { GameUserIDInputModal } from "../ui-figma/GameUserIDInputModal";

// 状態はなるべく一箇所に固めない
export type State = {
  userList: UserData[];
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

export function App(sources: Sources): Sinks {
  const domSo = DOM.getSo(sources);
  const skywaySo = SkyWay.getSo(sources);
  const users$: Stream<U.Streamed<UserData>[]> = skywaySo.connection$.fold(
    (acc: U.Streamed<UserData>[], c) => acc.concat(toUserData(c)),
    []
  );
  const clickNext$ = domSo
    .select(".go-button")
    .events("click");
  const showingGIDInput$: Stream<boolean> = clickNext$
    .mapTo(false)
    .startWith(true);
  const domSi: DOM.Sink = showingGIDInput$.map(WorldIDInputModal);
  const skywaySi: SkyWay.Sink = {
    join$: xs.create(),
    sendJSON$: xs.create(),
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
