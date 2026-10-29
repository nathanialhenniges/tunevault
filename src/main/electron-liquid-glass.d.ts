// This optional macOS dependency is intentionally absent on Windows installations.
declare module "electron-liquid-glass" {
  const glass: {
    addView(
      handle: Buffer,
      options?: { cornerRadius?: number; opaque?: boolean; tintColor?: string },
    ): number;
  };
  export default glass;
}
