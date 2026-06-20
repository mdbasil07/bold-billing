import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { toDateInputValue } from "../utils/date";

const today = () => toDateInputValue();

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const createExpenseForm = () => ({
  title: "",
  amount: "",
  date: today(),
  paymentMethod: "cash",
  cashAmount: "",
  gpayAmount: "",
  notes: ""
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
  const [form, setForm] = useState(createExpenseForm());
  const [editingExpense, setEditingExpense] = useState(null);
  const [message, setMessage] = useState("");

  const totalExpense = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const fetchExpenses = async (date = form.date) => {
    const res = await api.get(`/expenses?startDate=${date}&endDate=${date}`);
    setExpenses(res.data);
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

  const saveExpense = async (e) => {
    e.preventDefault();
    setMessage("");

    const payload = {
      title: form.title,
      amount: Number(form.amount),
      date: form.date,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
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

      const nextForm = createExpenseForm();

      setForm(nextForm);
      setEditingExpense(null);
      fetchExpenses(nextForm.date);
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
      notes: expense.notes || ""
    });
    setMessage("");
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
    fetchExpenses();
  };

  return (
    <main className="page-shell">
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
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
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
    </main>
  );
}

export default Expenses;
