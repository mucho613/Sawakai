import "./PasswordInputModal.scss";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as Snabbdom from "snabbdom-pragma";
import { VNode } from "@cycle/dom";
import { TextInputModal } from "./components/TextInputModal";

export const PasswordInputModal: VNode = (
  <div id="password-input-modal">
    {TextInputModal(
      "ワールド内でワンタイムパスワードが通知されました。",
      "次へ"
    )}
  </div>
);
