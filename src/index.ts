import {run} from '@cycle/run';
import {makeDOMDriver} from '@cycle/dom';
import "./scss/style.scss";
import {AppMock} from './components/App';
import * as DOM from './effects/DOM';
import * as UCon from './effects/UserConnections';
import * as StateE from './effects/State';
import { Component } from './types';

function main(sources: DOM.NamedSo): DOM.NamedSi {
    const app: Component<DOM.NamedSo, DOM.NamedSi> = UCon.runMock(AppMock);
    const sinks = app(sources);
    return sinks;
}

run(main, { DOM: makeDOMDriver("#app") });
