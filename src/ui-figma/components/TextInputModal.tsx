import "./TextInputModal.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";
import { GoButton } from "./GoButton";
import { TextInput } from "./TextInput";

export function TextInputModal(description: string, goText: string): VNode {
  return (
    <div className="text-input-modal">
      <div className="layout">
        {TextInput}
        {GoButton(goText)}
      </div>
      <div className="discription">{description}</div>
    </div>
  );
}
