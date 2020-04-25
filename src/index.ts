<<<<<<< HEAD
import { run } from "@cycle/run";
import { div, label, input, hr, h1, makeDOMDriver } from "@cycle/dom";
=======
import {run} from '@cycle/run';
import {makeDOMDriver} from '@cycle/dom';
>>>>>>> スケルトン
import "./scss/style.scss";
import {AppMock} from './components/App';
import * as DOM from './effects/DOM';
import * as UCon from './effects/UserConnections';
import * as StateE from './effects/State';
import { Component } from './types';

<<<<<<< HEAD
function main(sources): unknown {
  const input$ = sources.DOM.select(".field").events("input");

  const name$ = input$.map((ev) => ev.target.value).startWith("");

  const vdom$ = name$.map((name) =>
    div([
      label("Name: "),
      input(".field", { attrs: { type: "text" } }),
      hr(),
      h1("Hello " + name),
    ])
  );

  return { DOM: vdom$ };
=======
function main(sources: DOM.NamedSo): DOM.NamedSi {
    const app: Component<DOM.NamedSo, DOM.NamedSi> = UCon.runMock(AppMock);
    const sinks = app(sources);
    return sinks;
>>>>>>> スケルトン
}

run(main, { DOM: makeDOMDriver("#app") });
