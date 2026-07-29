interface HeaderProps {
  currentPage: string;
  setCurrentPage: (page: "home" | "collection" | "bespoke" | "heritage") => void;
}

export default function Header({ currentPage, setCurrentPage }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-top">
        <h1 
          className="app-title" 
          onClick={() => setCurrentPage("home")} 
          style={{ cursor: "pointer" }}
        >
          ꓘ-B <span className="accent">Kayaks</span>
        </h1>
        <div className="app-meta">
          <span>BESPOKE NAVAL ARCHITECTURE</span>
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
  );
}
