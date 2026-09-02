import { Font } from "@react-pdf/renderer";
import { fileURLToPath } from "node:url";

export const LIBERATION_SANS = "LiberationSans";

const regularSrc = fileURLToPath(
  new URL("./fonts/LiberationSans-Regular.ttf", import.meta.url),
);
const boldSrc = fileURLToPath(
  new URL("./fonts/LiberationSans-Bold.ttf", import.meta.url),
);
const italicSrc = fileURLToPath(
  new URL("./fonts/LiberationSans-Italic.ttf", import.meta.url),
);

let fontRegistered = false;

/** Regular / Bold / Italic, same SIL Liberation family vendored in T3. */
export function ensureLiberationSans(): void {
  if (fontRegistered) {
    return;
  }
  Font.register({
    family: LIBERATION_SANS,
    fonts: [
      { src: regularSrc, fontWeight: 400 },
      { src: boldSrc, fontWeight: 700 },
      { src: italicSrc, fontWeight: 400, fontStyle: "italic" },
    ],
  });
  fontRegistered = true;
}
