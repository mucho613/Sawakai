import xs, { Stream } from "xstream";
import flattenConcurrently from "xstream/extra/flattenConcurrently";
import * as D from "@cycle/dom";
import { Reducer } from "@cycle/state";
import * as Snabbdom from "snabbdom-pragma";
import { Position, Quaternion, Voice, UserData } from "../types";
import * as DOM from "../effects/DOM";
import * as Game from "../effects/Game";
import * as UCon from "../effects/UserConnections";
import * as Audio from "../effects/Audio";
import * as StateE from "../effects/State";
import * as U from "../util";
import { WorldIDInputModal } from "../ui-figma/WorldIDInputModal";

// 状態はなるべく一箇所に固めない
export type State = {
  userList: UserData[];
};

type Sources = DOM.NamedSo &
  UCon.NamedSo &
  /*Game.NamedSo & Audio.NamedSo & */ StateE.NamedSo<State>;
type Sinks = DOM.NamedSi &
  UCon.NamedSi &
  /*Game.NamedSi & Audio.NamedSi & */ StateE.NamedSi<State>;

export function AppMockInner(sources: Sources): Sinks {
  function f(x: number, y: number): number {
    return x + y;
  }
  //console.log(curried(f)(1)(2));
  const soUCon = UCon.getSo(sources);
  const soState = StateE.getSo(sources);
  const state$ = soState.stream;
  const addUser$: Stream<U.Endo<State>> = soUCon.map((con) => (s) => ({
    userList: s.userList.concat(con.userData),
  }));
  const removeUser$: Stream<Stream<U.Endo<State>>> = soUCon.map((con) =>
    con.closing.mapTo((s) => ({
      userList: s.userList.filter((d) => d.userID != con.userData.userID),
    }))
  );
  const s0 = { userList: [] };
  const siState = xs
    .merge(flattenConcurrently(removeUser$), addUser$)
    .map(U.toReducer<State>(s0));
  function show(d: UserData): D.VNode {
    return <h1>{d.minecraftID}</h1>;
  }
  //const siDOM = state$.map((s: State) => D.div(s.userList.map(show)));
  const siDOM = xs.of(WorldIDInputModal);
  const siUCon = xs.of({
    minecraftID: "winjii",
    userID: "winjii",
    voice: {},
  });
  return {
    ...DOM.nameSi(siDOM),
    ...UCon.nameSi(siUCon),
    ...StateE.nameSi<State>(siState),
  };
}

export const AppMock = StateE.run<State, Sources, Sinks>(AppMockInner);

function outputVoice(voice: Voice): Audio.NamedSi {
  throw new Error("not implemented");
}

type PlayerState = { pos: Position; quat: Quaternion };

function processAudio(state: PlayerState): (voice: Voice) => Voice {
  throw new Error("not implemented");
}

// function makeDriver() {
//     const context = new AudioContext();

//     return function Driver(source$) {
//         context.hogehoge();
//         return sink$;
//     }
// }
