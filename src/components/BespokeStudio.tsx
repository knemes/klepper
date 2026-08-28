import { useState, useMemo } from "react";
import { Download, Compass, Box } from "lucide-react";
import type { KayakParameters } from "../kayakGeometry/types";
import { KayakBuilder } from "../kayakGeometry/KayakBuilder";
import ThreeViewport from "./ThreeViewport";

interface BespokeStudioProps {
  params: KayakParameters;
  builder: KayakBuilder;
  onParamChange: (key: keyof KayakParameters, value: number) => void;
}

export default function BespokeStudio({ params, builder, onParamChange }: BespokeStudioProps) {
  // Configurator UI States
  const [viewMode, setViewMode] = useState<"perspective" | "plan" | "side">("perspective");
  const [showPhysics, setShowPhysics] = useState<boolean>(true);
  const [showRibs, setShowRibs] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [selectedRibIndex, setSelectedRibIndex] = useState<number>(3);
  const [expandedSection, setExpandedSection] = useState<string>("dimensions");

  const [cargoWeight, setCargoWeight] = useState<number>(180);
  const [hullWeight, setHullWeight] = useState<number>(45);

  // Compute hydrostatics and station layouts dynamically
  const hydrostatics = useMemo(() => {
    return builder.calculateHydrostatics(cargoWeight, hullWeight);
  }, [builder, params, cargoWeight, hullWeight]);

  const ribs = useMemo(() => {
    return builder.generateStations(hydrostatics.draft);
  }, [builder, params, hydrostatics.draft]);

  const activeRibIndex = Math.min(selectedRibIndex, ribs.length - 1);
  const selectedRib = ribs[activeRibIndex];

  const ribSVGString = useMemo(() => {
    if (!selectedRib) return "";
    return selectedRib.generateSVG(params);
  }, [selectedRib, params]);

  // Export 2D template SVG
  const handleDownloadSVG = () => {
    if (!selectedRib || !ribSVGString) return;
    const blob = new Blob([ribSVGString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `KB-Kayak-Station-${(selectedRib.x / 12).toFixed(1)}ft.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export 3D model as native Rhino .3dm file
  const handleDownload3DM = () => {
    try {
      const bytes = builder.export3dm();
      const blob = new Blob([bytes as any], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `KB-Kayak-Model-${params.length.toFixed(1)}ft.3dm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export .3dm file:", err);
      alert("Error generating Rhino .3dm file.");
    }
  };

  return (
    <div className="main-container">
      {/* Sidebar Configurator Panel */}
      <aside className="sidebar">
        {/* Section 1: Dimensions */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => setExpandedSection(expandedSection === "dimensions" ? "" : "dimensions")}
            style={{ cursor: "pointer" }}
          >
            <h2 className="sidebar-section-title">01. Hull Envelopes</h2>
            <span className="sidebar-section-number">[x05]</span>
          </div>

          {expandedSection === "dimensions" && (
            <div className="sidebar-content">
              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Overall Length</span>
                  <span className="control-value">{params.length.toFixed(1)} ft</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="20"
                  step="0.5"
                  value={params.length}
                  onChange={(e) => onParamChange("length", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Beam (Width)</span>
                  <span className="control-value">{params.beam.toFixed(1)} in</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="36"
                  step="0.1"
                  value={params.beam}
                  onChange={(e) => onParamChange("beam", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Beamiest Position (LCB)</span>
                  <span className="control-value">{Math.round(params.beamPlacement * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="0.75"
                  step="0.01"
                  value={params.beamPlacement}
                  onChange={(e) => onParamChange("beamPlacement", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Hull Depth</span>
                  <span className="control-value">{params.hullHeight.toFixed(1)} in</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="12"
                  step="0.1"
                  value={params.hullHeight}
                  onChange={(e) => onParamChange("hullHeight", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Total Crown Height</span>
                  <span className="control-value">{(params.totalHeight - params.hullHeight).toFixed(1)} in</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="10.0"
                  step="0.1"
                  value={params.totalHeight - params.hullHeight}
                  onChange={(e) => onParamChange("totalHeight", params.hullHeight + parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Shoulders */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => setExpandedSection(expandedSection === "profiles" ? "" : "profiles")}
            style={{ cursor: "pointer" }}
          >
            <h2 className="sidebar-section-title">02. Bow &amp; Stern Shoulders</h2>
            <span className="sidebar-section-number">[x04]</span>
          </div>

          {expandedSection === "profiles" && (
            <div className="sidebar-content">
              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Bow Length</span>
                  <span className="control-value">{params.bowLength} in</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="1"
                  value={params.bowLength}
                  onChange={(e) => onParamChange("bowLength", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Stern Length</span>
                  <span className="control-value">{params.sternLength} in</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="1"
                  value={params.sternLength}
                  onChange={(e) => onParamChange("sternLength", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Bow Shoulder Width</span>
                  <span className="control-value">{Math.round(params.bowWidthFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.01"
                  value={params.bowWidthFactor}
                  onChange={(e) => onParamChange("bowWidthFactor", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Stern Shoulder Width</span>
                  <span className="control-value">{Math.round(params.sternWidthFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="0.9"
                  step="0.01"
                  value={params.sternWidthFactor}
                  onChange={(e) => onParamChange("sternWidthFactor", parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Curvatures */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => setExpandedSection(expandedSection === "curvatures" ? "" : "curvatures")}
            style={{ cursor: "pointer" }}
          >
            <h2 className="sidebar-section-title">03. Rib Curvatures</h2>
            <span className="sidebar-section-number">[x05]</span>
          </div>

          {expandedSection === "curvatures" && (
            <div className="sidebar-content">
              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Bottom Flatness</span>
                  <span className="control-value">{(100 - params.hullHorizontalCurvature * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.01"
                  value={params.hullHorizontalCurvature}
                  onChange={(e) => onParamChange("hullHorizontalCurvature", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Chine Flaring</span>
                  <span className="control-value">{Math.round(params.hullVerticalCurvature * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.01"
                  value={params.hullVerticalCurvature}
                  onChange={(e) => onParamChange("hullVerticalCurvature", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Deck Arch Curvature</span>
                  <span className="control-value">{Math.round(params.deckVerticalCurvature * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.01"
                  value={params.deckVerticalCurvature}
                  onChange={(e) => onParamChange("deckVerticalCurvature", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Deck Crown Position</span>
                  <span className="control-value">{(params.deckLongitudinalPeak * params.length * 12).toFixed(0)}" ({Math.round(params.deckLongitudinalPeak * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.70"
                  step="0.005"
                  value={params.deckLongitudinalPeak}
                  onChange={(e) => onParamChange("deckLongitudinalPeak", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Facet Trim</span>
                  <span className="control-value">+{params.facetOffsetForward ?? 24}" (Peak @ {Math.round(builder.facetStartX)}")</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="30"
                  step="1"
                  value={params.facetOffsetForward ?? 24}
                  onChange={(e) => onParamChange("facetOffsetForward", parseFloat(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Cockpit */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => setExpandedSection(expandedSection === "cockpit" ? "" : "cockpit")}
            style={{ cursor: "pointer" }}
          >
            <h2 className="sidebar-section-title">04. Cockpit Coaming</h2>
            <span className="sidebar-section-number">[x04]</span>
          </div>

          {expandedSection === "cockpit" && (() => {
            const minCpStart = Math.max(12, Math.round(params.sternLength));
            const maxCpStart = Math.max(minCpStart, Math.floor(builder.facetStartX - params.cockpitLength - 1.0));
            return (
            <div className="sidebar-content">
              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Cockpit Length</span>
                  <span className="control-value">{params.cockpitLength} in</span>
                </div>
                <input
                  type="range"
                  min="28"
                  max="48"
                  step="1"
                  value={params.cockpitLength}
                  onChange={(e) => onParamChange("cockpitLength", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Cockpit Width</span>
                  <span className="control-value">{Math.round(params.cockpitWidth * 100)}% of Facet</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="1.00"
                  step="0.01"
                  value={params.cockpitWidth}
                  onChange={(e) => onParamChange("cockpitWidth", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Position from Stern</span>
                  <span className="control-value">{params.cockpitStart} in</span>
                </div>
                <input
                  type="range"
                  min={minCpStart}
                  max={maxCpStart}
                  step="1"
                  value={Math.max(minCpStart, Math.min(maxCpStart, params.cockpitStart))}
                  onChange={(e) => onParamChange("cockpitStart", parseFloat(e.target.value))}
                />
              </div>

              <div className="control-group">
                <div className="control-label-wrapper">
                  <span className="control-label">Coaming Height</span>
                  <span className="control-value">{(params.coamingHeight ?? 0.75).toFixed(2)} in</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={params.coamingHeight ?? 0.75}
                  onChange={(e) => onParamChange("coamingHeight", parseFloat(e.target.value))}
                />
              </div>
            </div>
            );
          })()}
        </div>

        {/* Section 5: Manufacturing Cutlist */}
        <div className="sidebar-section">
          <h2 className="sidebar-section-title" style={{ marginBottom: "1rem" }}>05. Station Cut-List</h2>

          <div className="control-group">
            <div className="control-label-wrapper">
              <span className="control-label">Station Spacing</span>
              <span className="control-value">{params.ribSpacing} in</span>
            </div>
            <input
              type="range"
              min="8"
              max="24"
              step="1"
              value={params.ribSpacing}
              onChange={(e) => onParamChange("ribSpacing", parseFloat(e.target.value))}
            />
          </div>

          {ribs.length > 0 && (
            <div className="control-group" style={{ marginTop: "1rem" }}>
              <label className="control-label" style={{ display: "block", marginBottom: "0.5rem" }}>
                Selected Station for Export:
              </label>
              <select
                value={activeRibIndex}
                onChange={(e) => setSelectedRibIndex(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  backgroundColor: "var(--parchment)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  padding: "0.4rem",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8rem",
                  boxSizing: "border-box"
                }}
              >
                {ribs.map((r, i) => (
                  <option key={i} value={i}>
                    Station @ {(r.x / 12).toFixed(2)}' ({r.x.toFixed(0)}")
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedRib && (
            <div className="ribs-viewer" style={{ marginTop: "1rem" }}>
              <span className="stat-label">2D Template (Cedar offset applied)</span>
              <div className="ribs-svg-container" dangerouslySetInnerHTML={{ __html: ribSVGString }} />
              <button
                className="btn-primary"
                onClick={handleDownloadSVG}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                <Download className="w-4 h-4" /> Download SVG
              </button>
            </div>
          )}
        </div>

        {/* Section 6: Hydrostatics Stats */}
        <div className="sidebar-section" style={{ borderBottom: "none" }}>
          <h2 className="sidebar-section-title" style={{ marginBottom: "1rem" }}>06. Hydrostatic Calculations</h2>

          <div className="control-group">
            <div className="control-label-wrapper">
              <span className="control-label">Paddler / Cargo</span>
              <span className="control-value">{cargoWeight} lbs</span>
            </div>
            <input
              type="range"
              min="100"
              max="300"
              step="5"
              value={cargoWeight}
              onChange={(e) => setCargoWeight(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <div className="control-label-wrapper">
              <span className="control-label">Hull Weight</span>
              <span className="control-value">{hullWeight} lbs</span>
            </div>
            <input
              type="range"
              min="25"
              max="70"
              step="1"
              value={hullWeight}
              onChange={(e) => setHullWeight(parseFloat(e.target.value))}
            />
          </div>

          <div className="stats-panel" style={{ marginTop: "1rem" }}>
            <div className="stat-row">
              <span className="stat-label">Target Displacement</span>
              <span className="stat-val">{hydrostatics.displacementLbs.toFixed(0)} lbs</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Calculated WL Draft</span>
              <span className="stat-val">{hydrostatics.draft.toFixed(2)} in</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Wetted Surface Area</span>
              <span className="stat-val">{(hydrostatics.wettedSurfaceArea / 144).toFixed(2)} sq ft</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Long. Centroid (LCB)</span>
              <span className="stat-val">{(hydrostatics.lcb / 12).toFixed(2)} ft</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Initial Stability (GM)</span>
              <span className="stat-val" style={{ color: "var(--accent)" }}>{hydrostatics.gm.toFixed(2)} in</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Stability Class</span>
              <span className="stat-val" style={{ fontSize: "0.75rem", fontStyle: "italic" }}>
                {hydrostatics.stabilityStatus}
              </span>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <button
              className="btn-primary"
              onClick={handleDownload3DM}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              <Box className="w-4 h-4" /> Download Rhino 3DM Model
            </button>
          </div>
        </div>
      </aside>

      {/* Viewport Render Area */}
      <main className="viewport-area">
        {/* View Mode Toolbar */}
        <div className="viewport-toolbar">
          <button
            className={`toolbar-btn ${viewMode === "perspective" ? "active" : ""}`}
            onClick={() => setViewMode(viewMode === "perspective" ? "perspective" : "perspective")} // toggle logic or state update
          >
            <Compass className="w-3.5 h-3.5 inline-block mr-1" /> ORBIT 3D
          </button>
          <button
            className={`toolbar-btn ${viewMode === "plan" ? "active" : ""}`}
            onClick={() => setViewMode("plan")}
          >
            PLAN (TOP)
          </button>
          <button
            className={`toolbar-btn ${viewMode === "side" ? "active" : ""}`}
            onClick={() => setViewMode("side")}
          >
            SIDE (PROFILE)
          </button>
        </div>

        {/* Visibility Overlays */}
        <div className="overlays-toolbar">
          <label className="overlay-toggle">
            <input
              type="checkbox"
              checked={showPhysics}
              onChange={(e) => setShowPhysics(e.target.checked)}
            />
            <span>PHYSICS &amp; WL</span>
          </label>
          <label className="overlay-toggle">
            <input
              type="checkbox"
              checked={showRibs}
              onChange={(e) => setShowRibs(e.target.checked)}
            />
            <span>PLYWOOD RIBS</span>
          </label>
          <label className="overlay-toggle">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => setShowDimensions(e.target.checked)}
            />
            <span>DIMENSIONS</span>
          </label>
        </div>

        {/* Viewport component */}
        <ThreeViewport
          params={params}
          builder={builder}
          viewMode={viewMode}
          showPhysics={showPhysics}
          showRibs={showRibs}
          showDimensions={showDimensions}
          draft={hydrostatics.draft}
          vcb={hydrostatics.vcb}
          lcb={hydrostatics.lcb}
        />
      </main>
    </div>
  );
}
