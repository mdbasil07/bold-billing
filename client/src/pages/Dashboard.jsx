import { useEffect, useState } from "react";
import api from "../services/api";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

function Dashboard({ isActive }) {
  const [data, setData] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalStockValue: 0,
    totalProducts: 0,
    totalExpenses: 0,
    netProfit: 0,
    todaySales: 0,
    todayProfit: 0,
    todayExpenses: 0,
    todayNetProfit: 0,
    todayPairsSold: 0,
    brandStockSummary: []
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    api.get("/dashboard").then((res) => {
      if (!ignore) {
        setData({
          totalSales: res.data.totalSales || 0,
          totalProfit: res.data.totalProfit || 0,
          totalStockValue: res.data.totalStockValue || res.data.stockValue || 0,
          totalProducts: res.data.totalProducts || 0,
          totalExpenses: res.data.totalExpenses || 0,
          netProfit: res.data.netProfit || 0,
          todaySales: res.data.todaySales || 0,
          todayProfit: res.data.todayProfit || 0,
          todayExpenses: res.data.todayExpenses || 0,
          todayNetProfit: res.data.todayNetProfit || 0,
          todayPairsSold: res.data.todayPairsSold || 0,
          brandStockSummary: res.data.brandStockSummary || []
        });
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive]);

  const totalMetrics = [
    {
      label: "Total Sales",
      value: formatCurrency(data.totalSales),
      tone: "blue"
    },
    {
      label: "Gross Profit",
      value: formatCurrency(data.totalProfit),
      tone: "green"
    },
    {
      label: "Expenses",
      value: formatCurrency(data.totalExpenses),
      tone: "red"
    },
    {
      label: "Net Profit",
      value: formatCurrency(data.netProfit),
      tone: "ink"
    }
  ];

  const todayMetrics = [
    {
      label: "Sales",
      value: formatCurrency(data.todaySales)
    },
    {
      label: "Profit",
      value: formatCurrency(data.todayProfit)
    },
    {
      label: "Expenses",
      value: formatCurrency(data.todayExpenses)
    },
    {
      label: "Net Profit",
      value: formatCurrency(data.todayNetProfit)
    }
  ];

  return (
    <main className="page-shell dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Bold Billing Dashboard</h1>
          <p className="dashboard-subtitle">
            Sales, profit, expenses and inventory value in one shop view.
          </p>
        </div>
        <div className="hero-net-card">
          <span>Net Profit</span>
          <strong>{formatCurrency(data.netProfit)}</strong>
        </div>
      </section>

      <section className="dashboard-total-grid">
        {totalMetrics.map((metric) => (
          <article className={`dashboard-stat-card ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-section-grid">
        <article className="dashboard-panel today-panel">
          <div className="section-heading">
            <h2>Today</h2>
          </div>
          <div className="today-grid">
            {todayMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel stock-panel">
          <div className="section-heading">
            <h2>Inventory</h2>
          </div>
          <div className="stock-focus">
            <span>Stock Value</span>
            <strong>{formatCurrency(data.totalStockValue)}</strong>
          </div>
          <div className="stock-mini">
            <span>Total Products</span>
            <strong>{data.totalProducts}</strong>
          </div>
        </article>
      </section>

      <section className="dashboard-panel brand-stock-panel">
        <div className="section-heading">
          <h2>Brand Stock Value</h2>
          <span className="summary-pill">{data.brandStockSummary.length} brands</span>
        </div>

        <div className="table-wrap brand-stock-wrap">
          <table className="sales-table brand-stock-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Products</th>
                <th>Pairs Remaining</th>
                <th>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {data.brandStockSummary.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    No brand stock available.
                  </td>
                </tr>
              ) : (
                data.brandStockSummary.map((item) => (
                  <tr key={item.brand}>
                    <td>{item.brand}</td>
                    <td>{item.products}</td>
                    <td>{item.pairsRemaining}</td>
                    <td>{formatCurrency(item.stockValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    </main>
  );
}

export default Dashboard;
