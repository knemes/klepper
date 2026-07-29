import type { KayakParameters } from "../kayakGeometry/types";

export interface PresetModel {
  name: string;
  tag: string;
  description: string;
  params: KayakParameters;
}

export const PRESET_MODELS: PresetModel[] = [
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

interface CollectionPageProps {
  loadPresetModel: (preset: PresetModel) => void;
}

export default function CollectionPage({ loadPresetModel }: CollectionPageProps) {
  return (
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
  );
}
