import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "./ErrorFallback";

describe("ErrorFallback", () => {
  it("renders error message and Try Again button", () => {
    render(
      <ErrorFallback
        error={new Error("Test explosion")}
        resetErrorBoundary={vi.fn()}
      />
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("calls resetErrorBoundary on Try Again click", async () => {
    const reset = vi.fn();
    render(
      <ErrorFallback error={new Error("boom")} resetErrorBoundary={reset} />
    );
    await userEvent.click(screen.getByText("Try Again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("works inside ErrorBoundary wrapping a throwing component", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    function ThrowingComponent() {
      throw new Error("render crash");
    }

    render(
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("render crash")).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
