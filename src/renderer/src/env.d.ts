/// <reference types="vite/client" />
interface Window {
  tunevault: {
    platform: string;
    nativeGlass?: boolean;
    onSystemThemeChanged(callback: (dark: boolean) => void): () => void;
    bootAppearance?: {
      systemDark?: boolean;
      appearance: "system" | "light" | "dark";
      accent: "blue" | "orange";
      dark?: boolean;
    };
    invoke(action: string, input?: unknown): Promise<any>;
    onChanged(callback: () => void): () => void;
    onMenu?(callback: (action: string) => void): () => void;
    droppedPaths(files: File[]): Promise<string[]>;
  };
}
