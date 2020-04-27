import { Stream } from "xstream";
import { Int } from "./int";

export type Component<So, Si> = (sources: So) => Si;

export type Env = {};

export type GameData = {
  gameUserID: string;
  gameClientID: string;
  position: Position;
  faceRotation: Quaternion;
};

export type Position = {
  x: number;
  y: number;
  z: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type UserData = {
  userID: UserID;
  minecraftID: MinecraftID;
  voice: Voice;
};

export type MinecraftID = string;

export type Voice = {};

export type UserID = string;
