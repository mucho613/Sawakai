import "./TextInput.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";

export function TextInput(placeholder: string): VNode {
  return (
    <div className="text-input">
      <input type="text" placeholder={placeholder} />
    </div>
  );
}
