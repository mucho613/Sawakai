type GameData = {
  gameUserID: string;
  gameClientID: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  faceDirection: {
    x: number;
    y: number;
    z: number;
  };
  upDirection: {
    x: number;
    y: number;
    z: number;
  };
};
export default GameData;
