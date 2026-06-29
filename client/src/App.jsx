import { lazy, Suspense, useEffect, useMemo, useState } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const DailySales = lazy(() => import("./pages/DailySales"));
const Expenses = lazy(() => import("./pages/Expenses"));
const ImportHistory = lazy(() => import("./pages/ImportHistory"));
const ImportStock = lazy(() => import("./pages/ImportStock"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));

const menuTabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "products", label: "Products" },
  { id: "importStock", label: "Import Stock" },
  { id: "dailySales", label: "Daily Sales" },
  { id: "salesHistory", label: "Sales History" },
  { id: "expenses", label: "Expenses" },
  { id: "reports", label: "Reports" },
  { id: "importHistory", label: "Import History" }
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("boldBillingTheme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("boldBillingTheme", theme);
  }, [theme]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDistance = Math.abs(currentScrollY - lastScrollY);

      if (scrollDistance > 4) {
        const isScrollingDown = currentScrollY > lastScrollY;
        setIsHeaderHidden(isScrollingDown && currentScrollY > 80);
      }

      lastScrollY = Math.max(currentScrollY, 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "light" ? "dark" : "light"
    );
  };

  const ActivePage = useMemo(() => {
    const pages = {
      dashboard: Dashboard,
      products: Products,
      importStock: ImportStock,
      dailySales: DailySales,
      salesHistory: SalesHistory,
      expenses: Expenses,
      reports: Reports,
      importHistory: ImportHistory
    };

    return pages[page] || Dashboard;
  }, [page]);

  return (
    <div className="app-shell" data-theme={theme}>
      <header className={`app-header ${isHeaderHidden ? "is-hidden" : ""}`}>
        <nav className="top-nav" aria-label="Primary navigation">
          {menuTabs.map((tab) => (
            <button
              className={`nav-button ${page === tab.id ? "active" : ""}`}
              key={tab.id}
              onClick={() => {
                setPage(tab.id);
                setIsHeaderHidden(false);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <label className="mobile-page-menu">
            Menu
            <select
              value={page}
              onChange={(e) => {
                setPage(e.target.value);
                setIsHeaderHidden(false);
              }}
            >
              {menuTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? "D" : "L"}
          </button>
        </div>
      </header>

      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <ActivePage isActive onNavigate={setPage} />
      </Suspense>
    </div>
  );
}

export default App;
