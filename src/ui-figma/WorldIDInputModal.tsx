import "./WorldIDInputModal.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";
import { TextInputModal } from "./components/TextInputModal";

export const WorldIDInputModal: VNode = (
  <div id="world-id-input-modal">
    {TextInputModal("ワールドIDを入力", "次へ")}
  </div>
);
