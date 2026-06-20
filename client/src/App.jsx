import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import DailySales from "./pages/DailySales";
import Expenses from "./pages/Expenses";
import ImportHistory from "./pages/ImportHistory";
import ImportStock from "./pages/ImportStock";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import SalesHistory from "./pages/SalesHistory";

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

  return (
    <div className="app-shell" data-theme={theme}>
      <nav className="top-nav">
        <button
          className={`nav-button ${page === "dashboard" ? "active" : ""}`}
          onClick={() => setPage("dashboard")}
        >
          Dashboard
        </button>

        <button
          className={`nav-button ${page === "products" ? "active" : ""}`}
          onClick={() => setPage("products")}
        >
          Products
        </button>

        <button
          className={`nav-button ${page === "importStock" ? "active" : ""}`}
          onClick={() => setPage("importStock")}
        >
          Import Stock
        </button>

        <button
          className={`nav-button ${page === "dailySales" ? "active" : ""}`}
          onClick={() => setPage("dailySales")}
        >
          Daily Sales
        </button>

        <button
          className={`nav-button ${page === "salesHistory" ? "active" : ""}`}
          onClick={() => setPage("salesHistory")}
        >
          Sales History
        </button>

        <button
          className={`nav-button ${page === "expenses" ? "active" : ""}`}
          onClick={() => setPage("expenses")}
        >
          Expenses
        </button>

        <button
          className={`nav-button ${page === "reports" ? "active" : ""}`}
          onClick={() => setPage("reports")}
        >
          Reports
        </button>

        <button
          className={`nav-button ${page === "importHistory" ? "active" : ""}`}
          onClick={() => setPage("importHistory")}
        >
          Import History
        </button>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? "D" : "L"}
        </button>
      </nav>

      <div className="page-view" hidden={page !== "dashboard"}>
        <Dashboard isActive={page === "dashboard"} />
      </div>
      <div className="page-view" hidden={page !== "products"}>
        <Products isActive={page === "products"} />
      </div>
      <div className="page-view" hidden={page !== "importStock"}>
        <ImportStock isActive={page === "importStock"} />
      </div>
      <div className="page-view" hidden={page !== "dailySales"}>
        <DailySales isActive={page === "dailySales"} />
      </div>
      <div className="page-view" hidden={page !== "salesHistory"}>
        <SalesHistory isActive={page === "salesHistory"} />
      </div>
      <div className="page-view" hidden={page !== "expenses"}>
        <Expenses isActive={page === "expenses"} />
      </div>
      <div className="page-view" hidden={page !== "reports"}>
        <Reports isActive={page === "reports"} />
      </div>
      <div className="page-view" hidden={page !== "importHistory"}>
        <ImportHistory isActive={page === "importHistory"} />
      </div>
    </div>
  );
}

export default App;
