import { existsSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";

import ErrorPage from "@/app/error";
import * as layoutModule from "@/app/layout";
import NotFound from "@/app/not-found";
import Home from "@/app/page";
import { SoundboardApp } from "@/components/soundboard/soundboard-app";

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

  test("home route returns the soundboard app shell", () => {
    const element = Home();

    expect(element.type).toBe(SoundboardApp);
  });

  test("renders the not-found route with a return-home link", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "This page does not exist" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return Home" }),
    ).toHaveAttribute("href", "/");
  });

  test("renders the error route digest and retries through reset", () => {
    const reset = vi.fn();

    render(
      <ErrorPage
        error={Object.assign(new Error("Unexpected"), { digest: "err-42" })}
        reset={reset}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Error ID: err-42")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Go Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("omits the error digest when one is not provided", () => {
    render(<ErrorPage error={new Error("Unexpected")} reset={() => undefined} />);

    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });
});
