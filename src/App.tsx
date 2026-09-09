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
    facetOffsetForward: 24,       // inches forward of deck crown point

    cockpitLength: 34,
    cockpitWidth: 1.0,      // 100% of max flat facet width
    cockpitStart: 59,       // inches from stern
    cockpitAftShape: 0.0,   // 0.0 (rounded ellipse) to 1.0 (keyhole with rounded corners)
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
      if (key === "length") {
        const newLength = Math.max(10, Math.min(20, value));
        const scaleRatio = newLength / (prev.length || 14);
        next.length = newLength;

        // Scale aft facet offset proportionally with length
        next.facetOffsetForward = Math.round(((prev.facetOffsetForward ?? (24 * (prev.length / 14))) * scaleRatio) * 10) / 10;

        // Scale bow and stern stem lengths proportionally
        next.bowLength = Math.max(8, Math.round(prev.bowLength * scaleRatio));
        next.sternLength = Math.max(6, Math.round(prev.sternLength * scaleRatio));

        // Scale cockpit dimensions proportionally so it fits naturally on scaled deck
        const minCpL = Math.max(20, Math.round(24 * (newLength / 14)));
        next.cockpitLength = Math.max(minCpL, Math.round(prev.cockpitLength * scaleRatio));
        next.cockpitStart = Math.max(Math.round(next.sternLength), Math.round(prev.cockpitStart * scaleRatio));
      }

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

      if (key === "facetOffsetForward") {
        const minOffset = Math.max(4, Math.round(6 * (next.length / 14)));
        const maxOffset = Math.max(20, Math.round(36 * (next.length / 14)));
        next.facetOffsetForward = Math.max(minOffset, Math.min(maxOffset, value));
      }

      if (key === "cockpitWidth") {
        next.cockpitWidth = Math.max(0.20, Math.min(1.0, value));
      }

      if (key === "cockpitAftShape") {
        next.cockpitAftShape = Math.max(0.0, Math.min(1.0, value));
      }

      const L_in = next.length * 12;

      // 1. Deck Crown Point bounds (30% to 70% of boat length)
      next.deckLongitudinalPeak = Math.max(0.30, Math.min(0.70, next.deckLongitudinalPeak));
      const peakX = next.deckLongitudinalPeak * L_in;

      // 2. Facet trimming plane extends facetOffsetForward (scales proportionally with boat length)
      const minFacetOffset = Math.max(4, Math.round(6 * (next.length / 14)));
      const maxFacetOffset = Math.max(20, Math.round(36 * (next.length / 14)));
      const facetOffset = Math.max(minFacetOffset, Math.min(maxFacetOffset, next.facetOffsetForward ?? (24 * (next.length / 14))));
      next.facetOffsetForward = facetOffset;
      const facetStartX = Math.min(L_in - 4.0, peakX + facetOffset);

      // 3. Cockpit coaming position hard rule: front of cockpit must NEVER touch the front part of the aft deck facet
      // Enforce at least 4.0 inches of clearance between forward edge of cockpit and facet apex
      const COCKPIT_FACET_CLEARANCE = 4.0;
      const minCpStart = Math.max(8, Math.round(next.sternLength));

      // Minimum cockpit length adapts down to 20" on shorter 10 ft boats so it always fits
      const minCpLength = Math.max(20, Math.round(24 * (next.length / 14)));
      const maxAllowedCpLength = Math.max(minCpLength, Math.floor(facetStartX - minCpStart - COCKPIT_FACET_CLEARANCE));
      next.cockpitLength = Math.max(minCpLength, Math.min(maxAllowedCpLength, next.cockpitLength));

      const maxCpStart = Math.max(minCpStart, Math.floor(facetStartX - next.cockpitLength - COCKPIT_FACET_CLEARANCE));
      next.cockpitStart = Math.max(minCpStart, Math.min(maxCpStart, next.cockpitStart));

      // 4. Ensure cockpit width factor and aft shape are valid
      next.cockpitWidth = Math.max(0.20, Math.min(1.0, next.cockpitWidth ?? 1.0));
      next.cockpitAftShape = Math.max(0.0, Math.min(1.0, next.cockpitAftShape ?? 0.0));

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
