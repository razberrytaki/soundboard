import { existsSync } from "node:fs";
import { join } from "node:path";

import * as layoutModule from "@/app/layout";

describe("App Router shell", () => {
  test("exports public-facing metadata and viewport defaults", () => {
    expect(layoutModule.metadata).toMatchObject({
      title: {
        default: "Soundboard",
        template: "%s | Soundboard",
      },
      description: "Locally persistent browser soundboard for custom audio pads.",
    });

    expect(layoutModule.viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      themeColor: "#efe7da",
    });

    const element = layoutModule.default({
      children: <div>Child</div>,
    });

    expect(element.type).toBe("html");
    expect(element.props.lang).toBe("en");
  });

  test("defines public not-found and error route files", () => {
    expect(existsSync(join(process.cwd(), "app/not-found.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/error.tsx"))).toBe(true);
  });
});
