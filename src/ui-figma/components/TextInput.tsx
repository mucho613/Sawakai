import "./TextInput.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";

export const TextInput: VNode = (
  <div className="text-input">
    <input type="text" />
  </div>
);
