import "./GoButton.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";

export function GoButton(text: string): VNode {
  return (
    <div className="go-button">
      <button>{text}</button>
    </div>
  );
}
