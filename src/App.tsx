import { useState, useMemo } from "react";
import { 
  type KayakParameters, 
  calculateHydrostatics, 
  generateRibStations, 
  generateRibSVG 
} from "./kayakGeometry";
import ThreeViewport from "./components/ThreeViewport";
import { 
  Anchor, 
  Download, 
  Compass,
  ArrowRight
} from "lucide-react";

// Pre-configured boat models
interface PresetModel {
  name: string;
  tag: string;
  description: string;
  params: KayakParameters;
}

const PRESET_MODELS: PresetModel[] = [
  {
    name: "The Osprey 12",
    tag: "Agile Recreational Craft",
    description: "Compact and highly maneuverable. Designed for lazy rivers, narrow estuaries, and quick afternoon paddles. Easiest to store and transport.",
    params: {
      length: 12,
      beam: 22,
      hullHeight: 9.5,
      totalHeight: 13.5,
      beamPlacement: 0.50,
      bowLength: 16,
      sternLength: 10,
      bowWidthFactor: 0.38,
      sternWidthFactor: 0.60,
      hullHorizontalCurvature: 0.45,
      hullVerticalCurvature: 0.52,
      deckVerticalCurvature: 0.35,
      deckLongitudinalPeak: 0.48,
      cockpitLength: 32,
      cockpitWidth: 17,
      cockpitStart: 68,
      ribSpacing: 12,
      plywoodThickness: 0.75
    }
  },
  {
    name: "The Explorer 14",
    tag: "Sporty Day Tourer",
    description: "A perfectly balanced touring craft offering responsive tracking, moderate cargo volume, and excellent initial stability. Our most popular design.",
    params: {
      length: 14,
      beam: 24,
      hullHeight: 10.5,
      totalHeight: 15.0,
      beamPlacement: 0.52,
      bowLength: 18,
      sternLength: 12,
      bowWidthFactor: 0.42,
      sternWidthFactor: 0.65,
      hullHorizontalCurvature: 0.35,
      hullVerticalCurvature: 0.48,
      deckVerticalCurvature: 0.45,
      deckLongitudinalPeak: 0.48,
      cockpitLength: 34,
      cockpitWidth: 19,
      cockpitStart: 80,
      ribSpacing: 12,
      plywoodThickness: 0.75
    }
  },
  {
    name: "The Ranger 16",
    tag: "Expedition Sea Vessel",
    description: "Built for open water, heavy seas, and week-long coastal expeditions. Massive storage volumes fore and aft, with exceptional secondary stability.",
    params: {
      length: 16,
      beam: 25,
      hullHeight: 11.5,
      totalHeight: 16.5,
      beamPlacement: 0.54,
      bowLength: 20,
      sternLength: 14,
      bowWidthFactor: 0.44,
      sternWidthFactor: 0.68,
      hullHorizontalCurvature: 0.28,
      hullVerticalCurvature: 0.44,
      deckVerticalCurvature: 0.50,
      deckLongitudinalPeak: 0.50,
      cockpitLength: 36,
      cockpitWidth: 20,
      cockpitStart: 94,
      ribSpacing: 12,
      plywoodThickness: 0.75
    }
  },
  {
    name: "The Whisperer 18",
    tag: "High-Speed Performance Hull",
    description: "A narrow, low-drag hull optimized for speed, open-sea racing, and experienced paddlers. Exceptional straight-line tracking and slicing efficiency.",
    params: {
      length: 18,
      beam: 20,
      hullHeight: 10.0,
      totalHeight: 14.5,
      beamPlacement: 0.56,
      bowLength: 24,
      sternLength: 16,
      bowWidthFactor: 0.35,
      sternWidthFactor: 0.58,
      hullHorizontalCurvature: 0.22,
      hullVerticalCurvature: 0.40,
      deckVerticalCurvature: 0.55,
      deckLongitudinalPeak: 0.52,
      cockpitLength: 32,
      cockpitWidth: 17,
      cockpitStart: 110,
      ribSpacing: 12,
      plywoodThickness: 0.75
    }
  }
];

export default function App() {
  // Navigation State
  const [currentPage, setCurrentPage] = useState<"home" | "collection" | "bespoke" | "heritage">("home");

  // Bespoke Studio Sliders State
  const [params, setParams] = useState<KayakParameters>({
    length: 14,             // feet
    beam: 24,               // inches
    hullHeight: 10.5,       // inches
    totalHeight: 15.0,      // inches
    beamPlacement: 0.52,    // relative X
    bowLength: 18,          // inches
    sternLength: 12,        // inches
    bowWidthFactor: 0.42,   // scaling factor
    sternWidthFactor: 0.65, // scaling factor
    
    hullHorizontalCurvature: 0.35,
    hullVerticalCurvature: 0.48,
    deckVerticalCurvature: 0.45,
    deckLongitudinalPeak: 0.48,

    cockpitLength: 34,
    cockpitWidth: 19,
    cockpitStart: 80,

    ribSpacing: 12,
    plywoodThickness: 0.75, // 3/4" plywood
  });

  // CAD Overlays States
  const [viewMode, setViewMode] = useState<"perspective" | "plan" | "side">("perspective");
  const [showPhysics, setShowPhysics] = useState<boolean>(true);
  const [showRibs, setShowRibs] = useState<boolean>(true);
  const [showStrips, setShowStrips] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [selectedRibIndex, setSelectedRibIndex] = useState<number>(3);
  const [expandedSection, setExpandedSection] = useState<string>("dimensions");

  const [cargoWeight, setCargoWeight] = useState<number>(180);
  const [hullWeight, setHullWeight] = useState<number>(45);

  // Hydrostatics & Rib calculations
  const hydrostatics = useMemo(() => {
    return calculateHydrostatics(params, cargoWeight, hullWeight);
  }, [params, cargoWeight, hullWeight]);

  const ribs = useMemo(() => {
    return generateRibStations(params, hydrostatics.draft);
  }, [params, hydrostatics.draft]);

  const activeRibIndex = Math.min(selectedRibIndex, ribs.length - 1);
  const selectedRib = ribs[activeRibIndex];

  const ribSVGString = useMemo(() => {
    if (!selectedRib) return "";
    return generateRibSVG(selectedRib, params);
  }, [selectedRib, params]);

  // Adjust parameters dynamically
  const handleParamChange = (key: keyof KayakParameters, value: number) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      
      // Validation constraints
      if (key === "hullHeight" && next.totalHeight <= value) {
        next.totalHeight = value + 2.5;
      }
      if (key === "totalHeight" && next.hullHeight >= value) {
        next.hullHeight = value - 2.5;
      }
      
      const L_in = next.length * 12;
      const facetStartX = L_in * next.deckLongitudinalPeak;
      // Cockpit front tip must sit at least 1.0 inch aft of the highest rib peak
      const maxCpStart = facetStartX - 1.0 - next.cockpitLength;
      
      if (next.cockpitStart > maxCpStart) {
        next.cockpitStart = Math.max(12, maxCpStart);
      }
      if (next.cockpitStart + next.cockpitLength > L_in - 12) {
        next.cockpitStart = L_in - next.cockpitLength - 12;
      }
      return next;
    });
  };

  // SVG Export
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

  // Inject a collection preset into Bespoke editor
  const loadPresetModel = (preset: PresetModel) => {
    setParams(preset.params);
    setCurrentPage("bespoke");
  };

  return (
    <>
      {/* Sticky Luxury Header */}
      <header className="app-header">
        <div className="header-top">
          <h1 className="app-title" onClick={() => setCurrentPage("home")} style={{ cursor: "pointer" }}>
            ꓘ-B <span className="accent">Kayaks</span>
          </h1>
          <div className="app-meta">
            <span>BEPOKE NAVAL ARCHITECTURE</span>
          </div>
        </div>

        {/* Rolls-Royce navigation bar */}
        <nav className="main-nav">
          <button 
            className={`nav-link ${currentPage === "home" ? "active" : ""}`}
            onClick={() => setCurrentPage("home")}
          >
            01. Experience
          </button>
          <button 
            className={`nav-link ${currentPage === "collection" ? "active" : ""}`}
            onClick={() => setCurrentPage("collection")}
          >
            02. The Collection
          </button>
          <button 
            className={`nav-link ${currentPage === "bespoke" ? "active" : ""}`}
            onClick={() => setCurrentPage("bespoke")}
          >
            03. Bespoke Studio
          </button>
          <button 
            className={`nav-link ${currentPage === "heritage" ? "active" : ""}`}
            onClick={() => setCurrentPage("heritage")}
          >
            04. Heritage
          </button>
        </nav>
      </header>

      {/* Pages Switch Router */}
      {currentPage === "home" && (
        <div className="page-container">
          <div className="hero-section">
            <span className="hero-subtitle">Wood Planking &amp; Math</span>
            <h2 className="hero-title">
              Crafted in Plywood.<br />Sculpted in Cedar.
            </h2>
            <p className="hero-description">
              "We synthesize advanced hydrodynamic engineering and traditional strip-built carpentry to create custom sea vessels tailored perfectly to your weight, style, and paddling waters."
            </p>
            <button className="btn-primary" onClick={() => setCurrentPage("collection")}>
              Explore The Collection <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          <div className="editorial-grid">
            <div className="vector-drawing-box">
              {/* Clean decorative CAD vector SVG drawing of a boat profile */}
              <svg viewBox="0 0 100 25" width="85%" height="85%">
                <path d="M 5 12.5 Q 20 4, 50 4 Q 80 4, 95 12.5 Q 80 21, 50 21 Q 20 21, 5 12.5 Z" fill="none" stroke="var(--pine-shadow)" strokeWidth="0.4" />
                <line x1="5" y1="12.5" x2="95" y2="12.5" stroke="var(--pine-shadow)" strokeWidth="0.15" strokeDasharray="1,1" />
                {/* Rib lines indicators */}
                {[20, 30, 40, 50, 60, 70, 80].map((x, idx) => (
                  <line key={idx} x1={x} y1="4.5" x2={x} y2="20.5" stroke="var(--moss-leaf)" strokeWidth="0.25" opacity="0.5" />
                ))}
                {/* Cockpit ellipse */}
                <ellipse cx="48" cy="12.5" rx="8" ry="4" fill="none" stroke="var(--pine-shadow)" strokeWidth="0.3" />
              </svg>
            </div>
            
            <div className="editorial-text">
              <h3>Bespoke Engineering</h3>
              <p>
                Every boat starts as a blank mathematical canvas. By controlling length, width, stem heights, and cross-section curvatures, we custom- loft a hull geometry matching your specific body metrics.
              </p>
              <p>
                Rather than standard stitch-and-glue folding, our boats are built by hand-bending 1/4" wide cedar strips over temporary 3/4" marine-plywood station ribs. This creates a structurally integrated, lightweight, and incredibly smooth composite structure.
              </p>
              <button className="btn-secondary" onClick={() => setCurrentPage("bespoke")}>
                Configure Bespoke Studio
              </button>
            </div>
          </div>
        </div>
      )}

      {currentPage === "collection" && (
        <div className="page-container">
          <div className="heritage-title-section">
            <span className="hero-subtitle">The Collection</span>
            <h2 className="hero-title" style={{ fontSize: "2.5rem", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              Pre-Configured Models
            </h2>
            <p className="hero-description" style={{ fontSize: "1.1rem", margin: 0 }}>
              Select a pre-designed envelope below. You can purchase them directly or open them inside the Bespoke Studio to customize and generate custom templates.
            </p>
          </div>

          <div className="collection-grid">
            {PRESET_MODELS.map((model, idx) => (
              <div key={idx} className="collection-card">
                <div className="card-header">
                  <span className="card-tag">{model.tag}</span>
                  <h3 className="card-title">{model.name}</h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4", margin: "0.5rem 0 0" }}>
                    {model.description}
                  </p>
                </div>

                <div>
                  <div className="card-specs">
                    <div className="spec-row">
                      <span className="spec-label">Overall Length</span>
                      <span className="spec-value">{model.params.length.toFixed(1)} ft</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Maximum Beam</span>
                      <span className="spec-value">{model.params.beam.toFixed(1)} in</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Hull Depth</span>
                      <span className="spec-value">{model.params.hullHeight.toFixed(1)} in</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">Expected Weight</span>
                      <span className="spec-value">{model.params.length * 3} lbs</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button className="btn-primary" onClick={() => loadPresetModel(model)} style={{ width: "100%" }}>
                      Configure Bespoke
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentPage === "bespoke" && (
        <div className="main-container">
          {/* Sidebar Configurator Panel */}
          <aside className="sidebar">
            
            {/* Section 1: Dimensions */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setExpandedSection(expandedSection === "dimensions" ? "" : "dimensions")} style={{ cursor: "pointer" }}>
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
                      onChange={(e) => handleParamChange("length", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("beam", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Beamiest Position (LCB)</span>
                      <span className="control-value">{Math.round(params.beamPlacement * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.35" 
                      max="0.65" 
                      step="0.01" 
                      value={params.beamPlacement} 
                      onChange={(e) => handleParamChange("beamPlacement", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Hull Depth</span>
                      <span className="control-value">{params.hullHeight.toFixed(1)} in</span>
                    </div>
                    <input 
                      type="range" 
                      min="8" 
                      max="15" 
                      step="0.1" 
                      value={params.hullHeight} 
                      onChange={(e) => handleParamChange("hullHeight", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Total Height (Crown)</span>
                      <span className="control-value">{params.totalHeight.toFixed(1)} in</span>
                    </div>
                    <input 
                      type="range" 
                      min="12" 
                      max="24" 
                      step="0.1" 
                      value={params.totalHeight} 
                      onChange={(e) => handleParamChange("totalHeight", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Profiles */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setExpandedSection(expandedSection === "profiles" ? "" : "profiles")} style={{ cursor: "pointer" }}>
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
                      onChange={(e) => handleParamChange("bowLength", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("sternLength", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("bowWidthFactor", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("sternWidthFactor", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Curvatures */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setExpandedSection(expandedSection === "curvatures" ? "" : "curvatures")} style={{ cursor: "pointer" }}>
                <h2 className="sidebar-section-title">03. Rib Curvatures</h2>
                <span className="sidebar-section-number">[x04]</span>
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
                      onChange={(e) => handleParamChange("hullHorizontalCurvature", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("hullVerticalCurvature", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Deck Crown Height</span>
                      <span className="control-value">{Math.round(params.deckVerticalCurvature * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="0.9" 
                      step="0.01" 
                      value={params.deckVerticalCurvature} 
                      onChange={(e) => handleParamChange("deckVerticalCurvature", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Deck Peak Position</span>
                      <span className="control-value">{Math.round(params.deckLongitudinalPeak * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.35" 
                      max="0.65" 
                      step="0.01" 
                      value={params.deckLongitudinalPeak} 
                      onChange={(e) => handleParamChange("deckLongitudinalPeak", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Cockpit */}
            <div className="sidebar-section">
              <div className="sidebar-section-header" onClick={() => setExpandedSection(expandedSection === "cockpit" ? "" : "cockpit")} style={{ cursor: "pointer" }}>
                <h2 className="sidebar-section-title">04. Cockpit Coaming</h2>
                <span className="sidebar-section-number">[x04]</span>
              </div>

              {expandedSection === "cockpit" && (
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
                      onChange={(e) => handleParamChange("cockpitLength", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Cockpit Width</span>
                      <span className="control-value">{params.cockpitWidth} in</span>
                    </div>
                    <input 
                      type="range" 
                      min="14" 
                      max="24" 
                      step="0.5" 
                      value={params.cockpitWidth} 
                      onChange={(e) => handleParamChange("cockpitWidth", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <div className="control-label-wrapper">
                      <span className="control-label">Position from Stern</span>
                      <span className="control-value">{params.cockpitStart} in</span>
                    </div>
                    <input 
                      type="range" 
                      min="40" 
                      max="110" 
                      step="1" 
                      value={params.cockpitStart} 
                      onChange={(e) => handleParamChange("cockpitStart", parseFloat(e.target.value))}
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
                      onChange={(e) => handleParamChange("coamingHeight", parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Manufacturing Cutlist */}
            <div className="sidebar-section">
              <h2 className="sidebar-section-title" style={{ marginBottom: "1rem" }}>05. Station Cut-List (3/4" Ply)</h2>
              
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
                  onChange={(e) => handleParamChange("ribSpacing", parseFloat(e.target.value))}
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
                  <button className="btn-primary" onClick={handleDownloadSVG} style={{ width: "100%", marginTop: "0.5rem" }}>
                    <Download className="w-4 h-4" /> Download SVG
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Viewport Render Canvas Area */}
          <main className="viewport-area">
            
            {/* View Mode Toolbar */}
            <div className="viewport-toolbar">
              <button 
                className={`toolbar-btn ${viewMode === "perspective" ? "active" : ""}`}
                onClick={() => setViewMode("perspective")}
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

            {/* Visibility Overlay Checks */}
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
                  checked={showStrips} 
                  onChange={(e) => setShowStrips(e.target.checked)}
                />
                <span>CEDAR STRIPS</span>
              </label>
              <label className="overlay-toggle">
                <input 
                  type="checkbox" 
                  checked={showDimensions} 
                  onChange={(e) => setShowDimensions(e.target.checked)}
                />
                <span>CAD BOUNDS</span>
              </label>
            </div>

            {/* 3D WebGL Canvas */}
            <ThreeViewport 
              params={params}
              viewMode={viewMode}
              showPhysics={showPhysics}
              showRibs={showRibs}
              showStrips={showStrips}
              showDimensions={showDimensions}
              draft={hydrostatics.draft}
              vcb={hydrostatics.vcb}
              lcb={hydrostatics.lcb}
            />

            {/* Real-time naval architecture HUD (horizontal bar below viewport) */}
            <div className="hud-bar">
              <div className="flex-row-between" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.4rem", marginBottom: "0.25rem" }}>
                <span className="sidebar-section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
                  <Anchor className="w-4 h-4 text-emerald-800" /> 06. Hydrostatic Feedback Solver
                </span>
                
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                  <span 
                    className={`control-value ${hydrostatics.gm < 1.0 ? "alert" : "success"}`}
                    style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                  >
                    {hydrostatics.stabilityStatus}
                  </span>
                  <span className="control-label" style={{ fontSize: "0.75rem" }}>
                    Disp. Mass: <strong style={{ color: "var(--text-primary)" }}>{cargoWeight + hullWeight} lbs</strong>
                  </span>
                </div>
              </div>

              {/* Grid of Sliders and Readouts */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "2rem", alignItems: "center" }}>
                {/* Weight Loading inputs */}
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="control-group" style={{ margin: 0, flex: 1 }}>
                    <div className="control-label-wrapper">
                      <span className="control-label" style={{ fontSize: "0.68rem" }}>Paddler Cargo</span>
                      <span className="control-value" style={{ fontSize: "0.65rem" }}>{cargoWeight} lbs</span>
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

                  <div className="control-group" style={{ margin: 0, flex: 1 }}>
                    <div className="control-label-wrapper">
                      <span className="control-label" style={{ fontSize: "0.68rem" }}>Hull Weight</span>
                      <span className="control-value" style={{ fontSize: "0.65rem" }}>{hullWeight} lbs</span>
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
                </div>

                {/* Hydrostatics Readout grid */}
                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
                  <div className="stat-card">
                    <span className="stat-label">Draft (T)</span>
                    <span className="stat-val" style={{ fontSize: "0.85rem" }}>{(hydrostatics.draft).toFixed(2)} in</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Stability (GM)</span>
                    <span className={`stat-val ${hydrostatics.gm < 1.0 ? "alert" : "success"}`} style={{ fontSize: "0.85rem" }}>
                      {(hydrostatics.gm).toFixed(2)} in
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Wetted Area</span>
                    <span className="stat-val" style={{ fontSize: "0.85rem" }}>{Math.round(hydrostatics.wettedSurfaceArea)} in²</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Buoyancy (LCB)</span>
                    <span className="stat-val" style={{ fontSize: "0.85rem" }}>{(hydrostatics.lcb / 12).toFixed(2)} ft</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {currentPage === "heritage" && (
        <div className="page-container">
          <div className="heritage-title-section">
            <span className="hero-subtitle">Our Heritage</span>
            <h2 className="hero-title" style={{ fontSize: "2.5rem", marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              Craft. Math. Forest. Sea.
            </h2>
            <p className="hero-description" style={{ fontSize: "1.1rem", margin: 0 }}>
              Deeply rooted in the timberlands of the Pacific Northwest, driven by a passion for open oceans.
            </p>
          </div>

          <div className="heritage-grid">
            <div className="heritage-sidebar">
              "We believe that a boat should not just look beautiful on the water. It must behave harmoniously with it, moving with organic grace and structural resilience."
            </div>

            <div className="heritage-body">
              <p>
                ꓘ-B Kayaks was founded to solve a singular gap in high-end boatbuilding: the mismatch between mass-production hulls and unique body proportions.
              </p>
              <p>
                Standard composite and plastic hulls force paddlers of different heights, weights, and cargo requirements into a handful of standardized molds. Our digital drafting studio breaks this constraint. By integrating classical naval geometry calculations with WebGL, we bring bespoke CAD customization to any screen.
              </p>
              <p>
                But a digital plan is only a blueprint. The soul of our boats lies in the wood. We build with western red cedar and Alaskan yellow cedar strips. Each strip is manually planed with a bead-and-cove joint, bent around our custom plywood rib frames, and laminated in clear fiberglass and epoxy. This produces a structural skin that showcases the organic variety of the wood grain while remaining stronger than steel by weight.
              </p>
              <p style={{ marginTop: "2rem" }}>
                <button className="btn-primary" onClick={() => setCurrentPage("bespoke")}>
                  Enter Bespoke Studio
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
