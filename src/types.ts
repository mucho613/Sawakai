import { Stream } from "xstream";
import { Int } from "./int";

export type Component<So, Si> = (sources: So) => Si;

export type Env = {};

export type GameData = {
  gameUserID: string;
  gameClientID: string;
  pose: Pose;
};

export type Pose = {
  pos: Position;
  faceDir: FaceDirection;
  headDir: HeadDirection;
};

export type Position = Vector3;
export type FaceDirection = Vector3;
export type HeadDirection = Vector3;

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type UserData = {
  userID: UserID;
  gameUserID: GameUserID;
  voice: Voice;
};

export type GameUserID = string;

export type Voice = MediaStream;

export type UserID = string;

export type AudioID = string;

export function toString(userID: UserID): string {
  return userID;
}
