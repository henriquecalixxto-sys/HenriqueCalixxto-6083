import { Platform } from "react-native";

export const colors = {
  black: "#111111",
  gold: "#C9A227",
  goldLight: "#E4C766",
  navy: "#0F1F38",
  gray: "#4A4A4A",
  grayLight: "#8A8A8A",
  cream: "#FAF8F4",
  white: "#FFFFFF",
  border: "#E4E0D8",
};

export const fonts = {
  display: Platform.select({ ios: "Cochin", android: "serif", default: "serif" }),
  body: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
};
