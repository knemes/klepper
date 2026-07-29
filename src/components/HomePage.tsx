import { ArrowRight } from "lucide-react";

interface HomePageProps {
  setCurrentPage: (page: "home" | "collection" | "bespoke" | "heritage") => void;
}

export default function HomePage({ setCurrentPage }: HomePageProps) {
  return (
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
            <path 
              d="M 5 12.5 Q 20 4, 50 4 Q 80 4, 95 12.5 Q 80 21, 50 21 Q 20 21, 5 12.5 Z" 
              fill="none" 
              stroke="var(--pine-shadow)" 
              strokeWidth="0.4" 
            />
            <line 
              x1="5" 
              y1="12.5" 
              x2="95" 
              y2="12.5" 
              stroke="var(--pine-shadow)" 
              strokeWidth="0.15" 
              strokeDasharray="1,1" 
            />
            {/* Rib lines indicators */}
            {[20, 30, 40, 50, 60, 70, 80].map((x, idx) => (
              <line 
                key={idx} 
                x1={x} 
                y1="4.5" 
                x2={x} 
                y2="20.5" 
                stroke="var(--moss-leaf)" 
                strokeWidth="0.25" 
                opacity="0.5" 
              />
            ))}
            {/* Cockpit ellipse */}
            <ellipse 
              cx="48" 
              cy="12.5" 
              rx="8" 
              ry="4" 
              fill="none" 
              stroke="var(--pine-shadow)" 
              strokeWidth="0.3" 
            />
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
  );
}
