import { lazy, Suspense, useEffect, useMemo, useState } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const DailySales = lazy(() => import("./pages/DailySales"));
const Expenses = lazy(() => import("./pages/Expenses"));
const ImportHistory = lazy(() => import("./pages/ImportHistory"));
const ImportStock = lazy(() => import("./pages/ImportStock"));
const Products = lazy(() => import("./pages/Products"));
const Reports = lazy(() => import("./pages/Reports"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));

const primaryTabs = [
  { id: "dashboard", label: "Dashboard", icon: "D" },
  { id: "products", label: "Inventory", icon: "I" },
  { id: "dailySales", label: "Daily Sales", icon: "S" },
  { id: "salesHistory", label: "History", icon: "H" },
  { id: "reports", label: "Reports", icon: "R" },
  { id: "expenses", label: "Expenses", icon: "E" }
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("boldBillingTheme") || "light"
  );

  useEffect(() => {
    localStorage.setItem("boldBillingTheme", theme);
  }, [theme]);

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
      <header className="app-header">
        <strong>Bold Billing</strong>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? "D" : "L"}
        </button>
      </header>

      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <ActivePage isActive onNavigate={setPage} />
      </Suspense>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {primaryTabs.map((tab) => (
          <button
            className={`nav-button ${page === tab.id ? "active" : ""}`}
            key={tab.id}
            onClick={() => setPage(tab.id)}
            type="button"
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
