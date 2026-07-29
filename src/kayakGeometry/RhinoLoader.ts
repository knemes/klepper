// @ts-ignore
import rhino3dm from "rhino3dm/rhino3dm.module.js";

let rhinoInstance: any = null;
let initPromise: Promise<any> | null = null;

/**
 * Asynchronously loads and initializes the rhino3dm WASM module.
 * Uses locateFile to fetch WASM from a CDN to simplify the build setup.
 */
export function loadRhino(): Promise<any> {
  if (rhinoInstance) {
    return Promise.resolve(rhinoInstance);
  }
  if (initPromise) {
    return initPromise;
  }

  // Cast rhino3dm as any since the package typing might vary depending on standard vs esm exports
  // Explicitly fetch the matching 8.32.0 WASM binary from the CDN to avoid cache mismatch
  initPromise = (rhino3dm as any)({
    locateFile: (path: string) => `https://cdn.jsdelivr.net/npm/rhino3dm@8.32.0/${path}`
  })
    .then((rhino: any) => {
      rhinoInstance = rhino;
      return rhino;
    })
    .catch((err: any) => {
      initPromise = null;
      console.error("Failed to initialize rhino3dm WASM:", err);
      throw err;
    });

  return initPromise!;
}

/**
 * Returns the loaded rhino3dm instance if already initialized, or null.
 */
export function getRhinoInstance(): any {
  return rhinoInstance;
}
