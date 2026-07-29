interface HeritagePageProps {
  setCurrentPage: (page: "home" | "collection" | "bespoke" | "heritage") => void;
}

export default function HeritagePage({ setCurrentPage }: HeritagePageProps) {
  return (
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
  );
}
