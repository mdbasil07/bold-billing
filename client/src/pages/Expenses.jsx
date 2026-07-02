import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { toDateInputValue } from "../utils/date";

const today = () => toDateInputValue();

const COMMON_EXPENSES = ["RZ", "CHIT", "SA", "BASHA", "AM", "TEA", "RB", "SUB", "JUNAID"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const createExpenseForm = (date = today()) => ({
  title: "",
  amount: "",
  date,
  paymentMethod: "cash",
  cashAmount: "",
  gpayAmount: "",
  notes: "",
  trackedExpenseKey: ""
});

const getExpenseBreakdown = (expense) => {
  const cash = Number(expense.paymentBreakdown?.cash || 0);
  const gpay = Number(expense.paymentBreakdown?.gpay || 0);

  if (cash || gpay) {
    return { cash, gpay };
  }

  return {
    cash: expense.paymentMethod === "gpay" ? 0 : Number(expense.amount || 0),
    gpay: expense.paymentMethod === "gpay" ? Number(expense.amount || 0) : 0
  };
};

const getPaymentLabel = (expense) => {
  const breakdown = getExpenseBreakdown(expense);

  if (breakdown.cash > 0 && breakdown.gpay > 0) {
    return `Cash ${formatCurrency(breakdown.cash)} + GPay ${formatCurrency(
      breakdown.gpay
    )}`;
  }

  return breakdown.gpay > 0 ? "GPay" : "Cash";
};

const formatDateInput = (value) => toDateInputValue(value);

function Expenses({ isActive }) {
  const [expenses, setExpenses] = useState([]);
  const [trackedExpenses, setTrackedExpenses] = useState([]);
  const [form, setForm] = useState(createExpenseForm());
  const [editingExpense, setEditingExpense] = useState(null);
  const [trackingStartDate, setTrackingStartDate] = useState(today());
  const [trackingEndDate, setTrackingEndDate] = useState(today());
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [message, setMessage] = useState("");

  const expenseSuggestions = useMemo(() => {
    const query = form.title.trim().toUpperCase();

    if (!query || form.trackedExpenseKey) {
      return [];
    }

    return COMMON_EXPENSES.filter((expenseKey) => expenseKey.startsWith(query));
  }, [form.title, form.trackedExpenseKey]);

  const activeSuggestionIndex = expenseSuggestions.length
    ? Math.min(Math.max(highlightedSuggestionIndex, 0), expenseSuggestions.length - 1)
    : -1;

  const totalExpense = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const trackedExpenseTotals = useMemo(() => {
    const totals = COMMON_EXPENSES.map((expenseKey) => ({
      key: expenseKey,
      amount: trackedExpenses
        .filter((expense) => expense.trackedExpenseKey === expenseKey)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    }));

    return totals;
  }, [trackedExpenses]);

  const otherTrackedRangeExpenses = useMemo(
    () => trackedExpenses.filter((expense) => !expense.trackedExpenseKey),
    [trackedExpenses]
  );

  const otherTrackedRangeTotal = useMemo(
    () =>
      otherTrackedRangeExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [otherTrackedRangeExpenses]
  );

  const fetchExpenses = async (date = form.date) => {
    const res = await api.get(`/expenses?startDate=${date}&endDate=${date}`);
    setExpenses(res.data);
  };

  const fetchTrackedExpenses = async (
    startDate = trackingStartDate,
    endDate = trackingEndDate
  ) => {
    const res = await api.get(`/expenses?startDate=${startDate}&endDate=${endDate}`);
    setTrackedExpenses(res.data);
  };

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    api.get(`/expenses?startDate=${form.date}&endDate=${form.date}`).then((res) => {
      if (!ignore) {
        setExpenses(res.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive, form.date]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    api
      .get(`/expenses?startDate=${trackingStartDate}&endDate=${trackingEndDate}`)
      .then((res) => {
        if (!ignore) {
          setTrackedExpenses(res.data);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isActive, trackingStartDate, trackingEndDate]);

  const saveExpense = async (e) => {
    e.preventDefault();
    setMessage("");

    const payload = {
      title: form.title,
      amount: Number(form.amount),
      date: form.date,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      trackedExpenseKey: form.trackedExpenseKey,
      paymentBreakdown:
        form.paymentMethod === "split"
          ? {
              cash: Number(form.cashAmount || 0),
              gpay: Number(form.gpayAmount || 0)
            }
          : undefined
    };

    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, payload);
        setMessage("Expense updated.");
      } else {
        await api.post("/expenses", payload);
        setMessage("Expense added.");
      }

      const savedDate = form.date;
      const nextForm = createExpenseForm(savedDate);

      setForm(nextForm);
      setEditingExpense(null);
      await fetchExpenses(savedDate);
      await fetchTrackedExpenses();
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save expense.");
    }
  };

  const editExpense = (expense) => {
    const breakdown = getExpenseBreakdown(expense);
    const paymentMethod =
      breakdown.cash > 0 && breakdown.gpay > 0
        ? "split"
        : breakdown.gpay > 0
          ? "gpay"
          : "cash";

    setEditingExpense(expense);
    setForm({
      title: expense.title || "",
      amount: String(expense.amount || ""),
      date: formatDateInput(expense.date),
      paymentMethod,
      cashAmount: String(breakdown.cash || ""),
      gpayAmount: String(breakdown.gpay || ""),
      notes: expense.notes || "",
      trackedExpenseKey: expense.trackedExpenseKey || ""
    });
    setMessage("");
  };

  const selectTrackedExpense = (expenseKey) => {
    setForm({
      ...form,
      title: expenseKey,
      trackedExpenseKey: expenseKey
    });
    setHighlightedSuggestionIndex(-1);
  };

  const handleTitleKeyDown = (e) => {
    if (!expenseSuggestions.length) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSuggestionIndex((currentIndex) =>
        currentIndex >= expenseSuggestions.length - 1 ? 0 : currentIndex + 1
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSuggestionIndex((currentIndex) =>
        currentIndex <= 0 ? expenseSuggestions.length - 1 : currentIndex - 1
      );
      return;
    }

    if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      selectTrackedExpense(expenseSuggestions[activeSuggestionIndex]);
      return;
    }

    if (e.key === "Escape") {
      setHighlightedSuggestionIndex(-1);
    }
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setForm(createExpenseForm());
    setMessage("");
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    await api.delete(`/expenses/${id}`);
    await fetchExpenses();
    await fetchTrackedExpenses();
  };

  return (
    <main className="page-shell expenses-page">
      <button
        className="expense-fab"
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        Add Expense
      </button>

      <section className="panel expense-form-panel">
        <form className="product-form" onSubmit={saveExpense}>
          <label>
            Title
            <div className="expense-title-box">
              <input
                value={form.title}
                onChange={(e) => {
                  setForm({
                    ...form,
                    title: e.target.value,
                    trackedExpenseKey: ""
                  });
                  setHighlightedSuggestionIndex(0);
                }}
                onKeyDown={handleTitleKeyDown}
                required
              />
              {expenseSuggestions.length > 0 && (
                <div className="expense-suggestions">
                  {expenseSuggestions.map((expenseKey, index) => (
                    <button
                      className={
                        index === activeSuggestionIndex ? "active" : undefined
                      }
                      key={expenseKey}
                      type="button"
                      onClick={() => selectTrackedExpense(expenseKey)}
                    >
                      {expenseKey}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>
            Amount
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label>
            Payment
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
              required
            >
              <option value="cash">Cash</option>
              <option value="gpay">GPay</option>
              <option value="split">Cash + GPay</option>
            </select>
          </label>
          {form.paymentMethod === "split" && (
            <>
              <label>
                Cash Amount
                <input
                  type="number"
                  min="0"
                  value={form.cashAmount}
                  onChange={(e) =>
                    setForm({ ...form, cashAmount: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                GPay Amount
                <input
                  type="number"
                  min="0"
                  value={form.gpayAmount}
                  onChange={(e) =>
                    setForm({ ...form, gpayAmount: e.target.value })
                  }
                  required
                />
              </label>
            </>
          )}
          <label className="form-wide">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button className="primary-button" type="submit">
            {editingExpense ? "Update Expense" : "Add Expense"}
          </button>
          {editingExpense && (
            <button className="ghost-button" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </form>
        {message && <p className="status-message">{message}</p>}
      </section>

      <section className="register-totals expense-totals">
        <article>
          <span>Total Expense</span>
          <strong>{formatCurrency(totalExpense)}</strong>
        </article>
      </section>

      <section className="panel register-panel">
        <div className="table-wrap">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id}>
                  <td>{new Date(expense.date).toLocaleDateString("en-IN")}</td>
                  <td>{expense.title}</td>
                  <td>{formatCurrency(expense.amount)}</td>
                  <td>{getPaymentLabel(expense)}</td>
                  <td>{expense.notes}</td>
                  <td className="table-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => editExpense(expense)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() => deleteExpense(expense._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-card-list expense-card-list">
          {expenses.length === 0 ? (
            <article className="data-card">
              <strong>No expenses found.</strong>
            </article>
          ) : (
            expenses.map((expense) => (
              <article className="data-card" key={expense._id}>
                <div className="card-topline">
                  <div>
                    <strong>{expense.title}</strong>
                    <span>{new Date(expense.date).toLocaleDateString("en-IN")}</span>
                  </div>
                  <span className="payment-badge">{getPaymentLabel(expense)}</span>
                </div>
                <div className="data-card-row">
                  <span>Amount</span>
                  <strong>{formatCurrency(expense.amount)}</strong>
                </div>
                {expense.notes && <p className="muted">{expense.notes}</p>}
                <div className="card-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => editExpense(expense)}
                  >
                    Edit
                  </button>
                  <button
                    className="ghost-button danger"
                    type="button"
                    onClick={() => deleteExpense(expense._id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel tracked-expense-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Tracked Expenses</span>
            <h2>Common expense totals</h2>
          </div>
        </div>
        <div className="history-filters">
          <label>
            From
            <input
              type="date"
              value={trackingStartDate}
              onChange={(e) => setTrackingStartDate(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={trackingEndDate}
              onChange={(e) => setTrackingEndDate(e.target.value)}
            />
          </label>
        </div>
        <div className="tracked-expense-grid">
          {trackedExpenseTotals.map((expense) => (
            <article key={expense.key}>
              <span>{expense.key}</span>
              <strong>{formatCurrency(expense.amount)}</strong>
            </article>
          ))}
        </div>
        <div className="other-expense-box">
          <div className="other-expense-heading">
            <h3>Other Expenses</h3>
            <strong>{formatCurrency(otherTrackedRangeTotal)}</strong>
          </div>
          {otherTrackedRangeExpenses.length === 0 ? (
            <p className="muted">No other expenses found.</p>
          ) : (
            <div className="other-expense-list">
              {otherTrackedRangeExpenses.map((expense) => (
                <article key={expense._id}>
                  <span>{new Date(expense.date).toLocaleDateString("en-IN")}</span>
                  <strong>{expense.title}</strong>
                  <b>{formatCurrency(expense.amount)}</b>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Expenses;
