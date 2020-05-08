import { run } from "@cycle/run";
import { makeDOMDriver } from "@cycle/dom";
import "./scss/style.scss";
import { App } from "./components/App";
import * as DOM from "./effects/DOM";
import * as SkyWay from "./effects/SkyWaySFU";
import * as AudioAPI from "./effects/WebAudioAPI";
import { Component } from "./types";

function main(sources: DOM.NamedSo): DOM.NamedSi {
  const app: Component<DOM.NamedSo, DOM.NamedSi> = AudioAPI.run(
    SkyWay.run(App)
  );
  const sinks = app(sources);
  return sinks;
}

run(main, { DOM: makeDOMDriver("#app") });
