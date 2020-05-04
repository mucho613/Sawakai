import "./WorldIDInputModal.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";
import { Stream } from "xstream";
import { TextInputModal } from "./components/TextInputModal";

export function WorldIDInputModal(showing: boolean): VNode {
  return (
    <div id="world-id-input-modal" className={showing ? "showing" : ""}>
      {TextInputModal("ワールドIDを入力", "次へ", "ワールドID")}
    </div>
  );
}
