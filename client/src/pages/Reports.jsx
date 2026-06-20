import { useEffect, useState } from "react";
import api from "../services/api";
import { toDateInputValue } from "../utils/date";

const today = () => toDateInputValue();

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

const formatFileDate = (value) =>
  new Date(`${value}T12:00:00.000`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long"
  });

const getRange = (mode, customStart, customEnd) => {
  const now = new Date();
  const end = today();

  if (mode === "today") {
    return { startDate: end, endDate: end };
  }

  if (mode === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayValue = toDateInputValue(yesterday);

    return { startDate: yesterdayValue, endDate: yesterdayValue };
  }

  if (mode === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { startDate: toDateInputValue(start), endDate: end };
  }

  if (mode === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toDateInputValue(start), endDate: end };
  }

  return { startDate: customStart, endDate: customEnd };
};

function Reports({ isActive }) {
  const [mode, setMode] = useState("today");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalExpenses: 0,
    netProfit: 0,
    balanceAmount: 0,
    pairsSold: 0,
    balances: {
      cash: 0,
      gpay: 0,
      card: 0
    },
    expenses: [],
    paymentTransfers: [],
    sales: []
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;
    const range = getRange(mode, startDate, endDate);
    const params = new URLSearchParams(range);

    api.get(`/reports?${params.toString()}`).then((res) => {
      if (!ignore) {
        setData(res.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive, mode, startDate, endDate]);

  const getReportTitle = () => {
    const range = getRange(mode, startDate, endDate);

    if (range.startDate === range.endDate) {
      return formatDate(`${range.startDate}T12:00:00.000`);
    }

    return `${formatDate(`${range.startDate}T12:00:00.000`)} - ${formatDate(
      `${range.endDate}T12:00:00.000`
    )}`;
  };

  const getReportFilename = () => {
    const range = getRange(mode, startDate, endDate);

    if (range.startDate === range.endDate) {
      return `Bold-${formatFileDate(range.startDate)}.png`;
    }

    return `Bold-${formatFileDate(range.startDate)} to ${formatFileDate(
      range.endDate
    )}.png`;
  };

  const exportPng = async () => {
    const width = 1120;
    const height = Math.max(620, 260 + Math.max(data.expenses.length, 1) * 42);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const margin = 52;
    const contentWidth = width - margin * 2;
    const leftWidth = 585;
    const rightX = margin + leftWidth + 36;
    const rightWidth = contentWidth - leftWidth - 36;

    const drawText = (text, x, y, options = {}) => {
      context.fillStyle = options.color || "#111827";
      context.font = `${options.weight || 400} ${options.size || 18}px Arial`;
      context.textAlign = options.align || "left";
      context.textBaseline = "top";
      context.fillText(String(text), x, y);
    };
    const drawLine = (x1, y1, x2, y2, color = "#111827", widthValue = 2) => {
      context.strokeStyle = color;
      context.lineWidth = widthValue;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    };
    const drawBox = (x, y, boxWidth, boxHeight) => {
      context.strokeStyle = "#d1d5db";
      context.lineWidth = 2;
      context.strokeRect(x, y, boxWidth, boxHeight);
    };
    const trimText = (text, maxWidth) => {
      const value = String(text || "");

      if (context.measureText(value).width <= maxWidth) {
        return value;
      }

      let nextValue = value;

      while (nextValue.length && context.measureText(`${nextValue}...`).width > maxWidth) {
        nextValue = nextValue.slice(0, -1);
      }

      return `${nextValue}...`;
    };

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    drawText("Bold Report", margin, margin, { size: 34, weight: 700 });
    drawText(getReportTitle(), width - margin, margin + 4, {
      size: 24,
      weight: 700,
      align: "right"
    });
    drawLine(margin, margin + 56, width - margin, margin + 56, "#111827", 3);

    const topY = margin + 88;
    const expensesHeight = Math.max(210, 92 + Math.max(data.expenses.length, 1) * 42);
    drawBox(margin, topY, leftWidth, expensesHeight);
    drawText("Expenses", margin + 18, topY + 18, { size: 22, weight: 700 });
    drawText("Title", margin + 18, topY + 58, { size: 17, weight: 900 });
    drawText("Amount", margin + leftWidth - 18, topY + 58, {
      size: 17,
      weight: 900,
      align: "right"
    });
    drawLine(margin + 18, topY + 86, margin + leftWidth - 18, topY + 86, "#e5e7eb", 1);

    if (data.expenses.length) {
      data.expenses.forEach((expense, index) => {
        const rowY = topY + 100 + index * 42;
        drawText(trimText(expense.title, 360), margin + 18, rowY, { size: 18 });
        drawText(formatCurrency(expense.amount), margin + leftWidth - 18, rowY, {
          size: 18,
          align: "right"
        });
        drawLine(margin + 18, rowY + 30, margin + leftWidth - 18, rowY + 30, "#e5e7eb", 1);
      });
    } else {
      drawText("No expenses", margin + leftWidth / 2, topY + 108, {
        size: 18,
        color: "#6b7280",
        align: "center"
      });
    }

    drawBox(rightX, topY, rightWidth, 360);
    const summaryLeft = rightX + 18;
    const summaryRight = rightX + rightWidth - 18;
    const summaryRows = [
      ["Total", formatCurrency(data.totalSales), 26],
      ["Exp", formatCurrency(data.totalExpenses), 26],
      ["Balance", formatCurrency(data.balanceAmount), 32]
    ];

    summaryRows.forEach(([label, value, fontSize], index) => {
      const rowY = topY + 22 + index * 68;
      drawText(label, summaryLeft, rowY, { size: fontSize, weight: 700 });
      drawText(value, summaryRight, rowY, {
        size: fontSize,
        weight: 700,
        align: "right"
      });
      drawLine(
        summaryLeft,
        rowY + fontSize + 14,
        summaryRight,
        rowY + fontSize + 14,
        "#111827",
        index === 2 ? 3 : 2
      );
    });

    const splitRows = [
      ["Cash", formatCurrency(data.balances?.cash || 0)],
      ["GPay", formatCurrency(data.balances?.gpay || 0)]
    ];

    if (data.balances?.card) {
      splitRows.push(["Card", formatCurrency(data.balances.card)]);
    }

    splitRows.forEach(([label, value], index) => {
      const rowY = topY + 246 + index * 42;
      drawText(label, summaryLeft, rowY, { size: 22, weight: 700 });
      drawText(value, summaryRight, rowY, { size: 22, weight: 700, align: "right" });
      drawLine(summaryLeft, rowY + 30, summaryRight, rowY + 30, "#9ca3af", 2);
    });

    const link = document.createElement("a");
    link.download = getReportFilename();
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="page-shell reports-page">
      <section className="panel compact-panel history-filters">
        <label>
          Range
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>
        {mode === "custom" && (
          <>
            <label>
              From
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </>
        )}
        <button className="primary-button export-button" onClick={exportPng}>
          Export PNG
        </button>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Sales</span>
          <strong>{formatCurrency(data.totalSales)}</strong>
        </article>
        <article className="metric-card">
          <span>Profit</span>
          <strong>{formatCurrency(data.totalProfit)}</strong>
        </article>
        <article className="metric-card">
          <span>Expenses</span>
          <strong>{formatCurrency(data.totalExpenses)}</strong>
        </article>
        <article className="metric-card">
          <span>Net Profit</span>
          <strong>{formatCurrency(data.netProfit)}</strong>
        </article>
        <article className="metric-card">
          <span>Pairs Sold</span>
          <strong>{data.pairsSold}</strong>
        </article>
      </section>
    </main>
  );
}

export default Reports;
