import "@testing-library/jest-dom";

// Prevent logger from routing to Tauri plugin in test environment
Object.defineProperty(window, "__TAURI_INTERNALS__", {
  value: undefined,
  writable: true,
});
