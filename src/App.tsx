import { useState, useEffect, useMemo } from "react";
import { loadRhino } from "./kayakGeometry/RhinoLoader";
import { KayakBuilder } from "./kayakGeometry/KayakBuilder";
import type { KayakParameters } from "./kayakGeometry/types";
import Header from "./components/Header";
import HomePage from "./components/HomePage";
import CollectionPage from "./components/CollectionPage";
import type { PresetModel } from "./components/CollectionPage";
import BespokeStudio from "./components/BespokeStudio";
import HeritagePage from "./components/HeritagePage";

export default function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<"home" | "collection" | "bespoke" | "heritage">("home");

  // rhino3dm WebAssembly instance states
  const [rhino, setRhino] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bespoke Studio Parameters State
  const [params, setParams] = useState<KayakParameters>({
    length: 14,             // feet (168 inches)
    beam: 28,               // inches
    hullHeight: 8.0,        // inches
    totalHeight: 12.0,      // inches
    beamPlacement: 0.52,    // relative X
    bowLength: 18,          // inches
    sternLength: 12,        // inches
    bowWidthFactor: 0.42,   // scaling factor
    sternWidthFactor: 0.65, // scaling factor

    hullHorizontalCurvature: 0.35,
    hullVerticalCurvature: 0.48,
    deckVerticalCurvature: 0.45,
    deckLongitudinalPeak: 0.5536, // 93" from stern (75" from bow)

    cockpitLength: 34,
    cockpitWidth: 19,
    cockpitStart: 59,       // 93" - 34" = 59" from stern

    ribSpacing: 12,
    plywoodThickness: 0.75, // 3/4" plywood
    coamingHeight: 0.75,    // 3/4" coaming height
  });

  // Initialize rhino3dm WASM on application mount
  useEffect(() => {
    loadRhino()
      .then((rhinoInstance) => {
        setRhino(rhinoInstance);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadError("Failed to initialize the Rhino3D WebAssembly engine. Please refresh or try another browser.");
        setLoading(false);
      });
  }, []);

  // Instantiates the core builder instance whenever parameters change
  const builder = useMemo(() => {
    if (!rhino) return null;
    return new KayakBuilder(rhino, params);
  }, [rhino, params]);

  // Adjust parameters dynamically with geometric constraints
  const handleParamChange = (key: keyof KayakParameters, value: number) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };

      // Validation constraints
      if (key === "beam") {
        next.beam = Math.max(18, Math.min(36, value));
      }
      if (key === "beamPlacement") {
        next.beamPlacement = Math.max(0.25, Math.min(0.75, value));
      }

      if (key === "hullHeight") {
        const clampedHull = Math.max(6, Math.min(12, value));
        const prevCrown = prev.totalHeight - prev.hullHeight;
        next.hullHeight = clampedHull;
        next.totalHeight = clampedHull + Math.max(1.5, prevCrown);
      }
      if (key === "totalHeight") {
        next.totalHeight = Math.max(next.hullHeight + 1.5, value);
      }

      const L_in = next.length * 12;

      // 1. Lock peak to the front end of the cockpit
      const facetStartX = next.cockpitStart + next.cockpitLength;
      next.deckLongitudinalPeak = facetStartX / L_in;

      // 2. Cockpit must sit within the main body of the hull (12" margin from bow)
      if (facetStartX > L_in - 12) {
        next.cockpitStart = L_in - 12 - next.cockpitLength;
      }
      if (next.cockpitStart < 12) {
        next.cockpitStart = 12;
      }

      // 3. Cap cockpit width based on the trimmed flat facet width at cockpit center
      const cpCenterX = next.cockpitStart + next.cockpitLength / 2;
      const sternDeckZ = next.hullHeight;
      const currentFacetStartX = next.cockpitStart + next.cockpitLength;
      const slope = (next.totalHeight - sternDeckZ) / (currentFacetStartX || 1);
      const planeZ = sternDeckZ + cpCenterX * slope;

      const gunwaleY = (next.beam / 2) * Math.sin(Math.PI * cpCenterX / L_in);
      const gunwaleZ = next.hullHeight - 1.0;
      const deckZ_untrimmed = sternDeckZ + (next.totalHeight - sternDeckZ) * Math.sin(Math.PI * cpCenterX / L_in);

      const pPower = 1.0 + next.deckVerticalCurvature * 2.2;
      const yPct = Math.max(0, Math.min(1, (deckZ_untrimmed - planeZ) / (deckZ_untrimmed - gunwaleZ || 1)));
      const yFlat = gunwaleY * Math.pow(yPct, 1.0 / pPower);

      const maxCpWidth = Math.max(10.0, yFlat * 2 - 1.0);
      if (next.cockpitWidth > maxCpWidth) {
        next.cockpitWidth = maxCpWidth;
      }
      return next;
    });
  };

  // Inject a collection preset into Bespoke editor
  const loadPresetModel = (preset: PresetModel) => {
    setParams(preset.params);
    setCurrentPage("bespoke");
  };

  // Sleek, premium startup loader screen
  if (loading) {
    return (
      <div
        className="page-container"
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eae7df",
          color: "#14231a"
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "450px" }}>
          <h1
            style={{
              fontFamily: "serif",
              fontWeight: 300,
              letterSpacing: "4px",
              margin: "0 0 1rem",
              fontSize: "1.8rem"
            }}
          >
            ꓘ-B KAYAKS
          </h1>
          <div
            style={{
              fontSize: "0.75rem",
              fontFamily: "monospace",
              opacity: 0.7,
              letterSpacing: "2px",
              textTransform: "uppercase"
            }}
          >
            Initializing CAD Geometry Engine...
          </div>
          <div
            className="loader-bar"
            style={{
              width: "150px",
              height: "1px",
              backgroundColor: "rgba(20,35,26,0.3)",
              margin: "1.5rem auto 0",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: "60px",
                height: "100%",
                backgroundColor: "#14231a",
                position: "absolute",
                animation: "loading-slide 1.5s infinite ease-in-out"
              }}
            />
          </div>
        </div>
        <style>{`
          @keyframes loading-slide {
            0% { left: -60px; }
            100% { left: 150px; }
          }
        `}</style>
      </div>
    );
  }

  // Load failure fallback
  if (loadError) {
    return (
      <div
        className="page-container"
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eae7df",
          color: "#802020",
          textAlign: "center",
          padding: "2rem"
        }}
      >
        <div>
          <h2 style={{ fontFamily: "serif", margin: "0 0 1rem" }}>System Initialization Error</h2>
          <p style={{ fontFamily: "monospace", fontSize: "0.85rem", opacity: 0.8, maxWidth: "500px", margin: "0 auto" }}>
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {currentPage === "home" && (
        <HomePage setCurrentPage={setCurrentPage} />
      )}

      {currentPage === "collection" && (
        <CollectionPage loadPresetModel={loadPresetModel} />
      )}

      {currentPage === "bespoke" && builder && (
        <BespokeStudio
          params={params}
          builder={builder}
          onParamChange={handleParamChange}
        />
      )}

      {currentPage === "heritage" && (
        <HeritagePage setCurrentPage={setCurrentPage} />
      )}
    </>
  );
}
