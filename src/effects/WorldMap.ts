import "./Main.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
export type WorldMapVisualizeRequest = {
  addUser: UserID;
  removeUser: UserID;
  updateUser: { id: UserID; pose: Pose };
};

export type Source = {
  normalizedVoice$: Stream<Voice>;
};
export type Sink = {
  virtualizeRequest$: U.Streamed<WorldMapVisualizeRequest>;
  initScene$: Stream<[]>;
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

const worldMap = (
  stream$: Stream<[THREE.Scene, U.Sum<WorldMapVisualizeRequest>]>
): void => {
  console.log("virtualize!!!!!!!!");
  type State = {
    id: UserID;
    object: THREE.Object3D;
  }[];
  const state0: State = [];

  const addUser = (scene: THREE.Scene) => (id: UserID): U.Endo<State> => (
    s
  ) => {
    console.log("add speaker");
    const user = s.find((d) => d.id == id);
    if (user) return s;

    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    const cylinder = new THREE.Mesh(geometry, material);
    scene.add(cylinder);

    return s.concat([
      {
        id: id,
        object: cylinder,
      },
    ]);
  };

  const removeUser = (scene: THREE.Scene) => (id: UserID): U.Endo<State> => (
    s
  ) => {
    console.log("remove speaker");
    const user = s.find((d) => d.id == id);
    if (!user) return s;
    scene.remove(user.object);
    return s.filter((d) => d.id != id);
  };

  const updateUser = () => (
    req: WorldMapVisualizeRequest["updateUser"]
  ): U.Endo<State> => (s) => {
    const user = s.find((d) => d.id == req.id);
    if (user) {
      const { x, y, z } = req.pose.pos;
      user.object.position.set(x, y, z);
    }
    return s;
  };

  StateE.runSimple<State>((stateSo) => {
    stateSo.stream.subscribe({
      next: (s) => {
        console.log("state!!!", s);
      },
    });
    console.log("debug!!!!!!!!!!!!!!");
    const endo$ = stream$.debug("mapRequestSum$ 3").map(([scene, req]) =>
      U.caseOf(U.proxy<WorldMapVisualizeRequest>())(req)<U.Endo<State>>({
        addUser: addUser(scene),
        removeUser: removeUser(scene),
        updateUser: updateUser(),
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

const initScene = (): Stream<THREE.Scene> => {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("white");
  scene.fog = new THREE.Fog(0xffffff, 10, 100);
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;

  const axesHelper = new THREE.AxesHelper(10);
  axesHelper.position.y = 0.001;
  scene.add(axesHelper);

  const gridHelper = new THREE.GridHelper(1000, 1000);
  scene.add(gridHelper);

  camera.position.y = 5;
  camera.position.z = 5;

  const animate = (): void => {
    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
  };

  animate();

  return xs.of(scene);
};

export function run<Sos extends NamedSo, Sis extends NamedSi>(
  component: Component<Sos, Sis>
): Component<Omit<Sos, Name>, Omit<Sis, Name>> {
  return (sources) => {
    const source: Source = { normalizedVoice$: xs.create() };
    const sinks = component({ ...sources, ...nameSo(source) } as Sos);
    const sink = getSi(sinks);

    const vRequestSum$ = U.unstreamedSum(sink.virtualizeRequest$);
    const scene$: Stream<THREE.Scene> = sink.initScene$
      .map(initScene)
      .flatten();
    worldMap(xs.combine(scene$, Op.delayUntil(scene$)(vRequestSum$)));
    return { ...sinks };
  };
}
