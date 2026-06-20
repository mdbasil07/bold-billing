import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { toDateInputValue } from "../utils/date";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const getToday = () => toDateInputValue();

const createId = () =>
  crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createDraftRow = () => ({
  id: createId(),
  productId: "",
  productQuery: "",
  quantity: "1",
  purchasePrice: "",
  sellingPrice: "",
  cashAmount: "",
  gpayAmount: "",
  cardAmount: "",
  notes: ""
});

function DailySales({ isActive }) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [paymentTransfers, setPaymentTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [draftRows, setDraftRows] = useState([createDraftRow()]);
  const [editingSale, setEditingSale] = useState(null);
  const [editForm, setEditForm] = useState({
    productId: "",
    productName: "",
    quantity: "1",
    purchasePrice: "",
    sellingPrice: "",
    cashAmount: "",
    gpayAmount: "",
    cardAmount: "",
    notes: ""
  });
  const [transferForm, setTransferForm] = useState({
    direction: "cash-to-gpay",
    amount: "",
    notes: ""
  });
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [draggedSaleId, setDraggedSaleId] = useState("");
  const [dragOverSaleId, setDragOverSaleId] = useState("");

  const getProductQuantity = (product) =>
    product?.quantity ??
    product?.sizes?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ??
    0;

  const productOptions = useMemo(
    () =>
      products.filter((product) => getProductQuantity(product) > 0),
    [products]
  );

  const totals = useMemo(() => {
    const savedTotals = sales.reduce(
      (sum, sale) => ({
        totalSales: sum.totalSales + sale.totalAmount,
        cashSales: sum.cashSales + Number(sale.paymentBreakdown?.cash || 0),
        gpaySales: sum.gpaySales + Number(sale.paymentBreakdown?.gpay || 0)
      }),
      { totalSales: 0, cashSales: 0, gpaySales: 0 }
    );

    const salesTotals = draftRows.reduce((sum, row) => {
      const product = products.find((item) => item._id === row.productId);
      const sellingPrice = Number(row.sellingPrice);
      const purchasePrice = Number(row.purchasePrice);
      const quantity = Number(row.quantity);
      const isManual = row.productQuery.trim() && !row.productId;
      const rowTotal = sellingPrice * quantity;
      const rowPayments = {
        cashSales: Number(row.cashAmount || 0),
        gpaySales: Number(row.gpayAmount || 0)
      };

      if (!sellingPrice || !quantity) {
        return sum;
      }

      if (isManual && purchasePrice) {
        return {
          totalSales: sum.totalSales + rowTotal,
          cashSales: sum.cashSales + rowPayments.cashSales,
          gpaySales: sum.gpaySales + rowPayments.gpaySales
        };
      }

      if (!product) {
        return sum;
      }

      return {
        totalSales: sum.totalSales + rowTotal,
        cashSales: sum.cashSales + rowPayments.cashSales,
        gpaySales: sum.gpaySales + rowPayments.gpaySales
      };
    }, savedTotals);

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );
    const expenseTotals = expenses.reduce(
      (sum, expense) => {
        const amount = Number(expense.amount || 0);
        const hasBreakdown =
          expense.paymentBreakdown &&
          (expense.paymentBreakdown.cash > 0 || expense.paymentBreakdown.gpay > 0);
        const cash = hasBreakdown
          ? Number(expense.paymentBreakdown.cash || 0)
          : expense.paymentMethod === "gpay"
            ? 0
            : amount;
        const gpay = hasBreakdown
          ? Number(expense.paymentBreakdown.gpay || 0)
          : expense.paymentMethod === "gpay"
            ? amount
            : 0;

        return {
          cash: sum.cash + cash,
          gpay: sum.gpay + gpay
        };
      },
      { cash: 0, gpay: 0 }
    );
    const transferTotals = paymentTransfers.reduce(
      (sum, transfer) => {
        const amount = Number(transfer.amount || 0);

        if (transfer.direction === "cash-to-gpay") {
          return {
            cashAdjustment: sum.cashAdjustment - amount,
            gpayAdjustment: sum.gpayAdjustment + amount
          };
        }

        return {
          cashAdjustment: sum.cashAdjustment + amount,
          gpayAdjustment: sum.gpayAdjustment - amount
        };
      },
      { cashAdjustment: 0, gpayAdjustment: 0 }
    );

    const cashBalanceBeforeExpenses =
      salesTotals.cashSales + transferTotals.cashAdjustment;
    const gpayBalanceBeforeExpenses =
      salesTotals.gpaySales + transferTotals.gpayAdjustment;

    return {
      ...salesTotals,
      totalExpenses,
      cashBalance: cashBalanceBeforeExpenses - expenseTotals.cash,
      gpayBalance: gpayBalanceBeforeExpenses - expenseTotals.gpay,
      balanceAmount: salesTotals.totalSales - totalExpenses
    };
  }, [draftRows, expenses, paymentTransfers, products, sales]);

  const getPaymentLabel = (sale) => {
    if (sale.paymentMethod) {
      return sale.paymentMethod;
    }

    const methods = [
      sale.paymentBreakdown?.cash > 0 ? "Cash" : null,
      sale.paymentBreakdown?.gpay > 0 ? "GPay" : null,
      sale.paymentBreakdown?.card > 0 ? "Card" : null
    ].filter(Boolean);

    return methods.length > 2 ? "Mixed" : methods.join(" + ");
  };

  const getDraftRowTotal = (row) =>
    Number(row.sellingPrice || 0) * Number(row.quantity || 0);

  const getDraftPaidAmount = (row) =>
    Number(row.cashAmount || 0) +
    Number(row.gpayAmount || 0) +
    Number(row.cardAmount || 0);

  const isPaymentFieldDisabled = (row, field) => {
    const rowTotal = getDraftRowTotal(row);
    const currentValue = Number(row[field] || 0);

    return rowTotal > 0 && currentValue <= 0 && getDraftPaidAmount(row) >= rowTotal;
  };

  const fetchSales = async (date) => {
    const res = await api.get(`/sales?date=${date}`);
    setSales(res.data);
  };

  const fetchProducts = async () => {
    const res = await api.get("/products");
    setProducts(res.data);
  };

  const fetchExpenses = async (date) => {
    const res = await api.get(`/expenses?startDate=${date}&endDate=${date}`);
    setExpenses(res.data);
  };

  const fetchPaymentTransfers = async (date) => {
    const res = await api.get(`/payment-transfers?startDate=${date}&endDate=${date}`);
    setPaymentTransfers(res.data);
  };

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    Promise.all([
      api.get(`/sales?date=${selectedDate}`),
      api.get("/products"),
      api.get(`/expenses?startDate=${selectedDate}&endDate=${selectedDate}`),
      api.get(`/payment-transfers?startDate=${selectedDate}&endDate=${selectedDate}`)
    ]).then(([salesRes, productsRes, expensesRes, transferRes]) => {
      if (!ignore) {
        setSales(salesRes.data);
        setProducts(productsRes.data);
        setExpenses(expensesRes.data);
        setPaymentTransfers(transferRes.data);
        setTransferForm({ direction: "cash-to-gpay", amount: "", notes: "" });
        setDraftRows([createDraftRow()]);
        setMessage("");
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive, selectedDate]);

  const getProduct = (productId) =>
    products.find((product) => product._id === productId);

  const getProductName = (product) =>
    product.brand && product.articleNumber
      ? `${product.brand}-${product.articleNumber}`
      : product.name || "";

  const getProductLabel = (product) => `${getProductName(product)} - ${product.color}`;

  const findProductFromQuery = (query) =>
    productOptions.find(
      (product) =>
        getProductLabel(product).toLowerCase() === query.toLowerCase() ||
        getProductName(product).toLowerCase() === query.toLowerCase()
    );

  const updateDraftRow = (rowId, field, value) => {
    setDraftRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (field === "productQuery") {
          const product = findProductFromQuery(value);

          return {
            ...row,
            productQuery: value,
            productId: product ? product._id : "",
            purchasePrice: product ? String(product.purchasePrice) : row.purchasePrice
          };
        }

        if (field === "productId") {
          const product = getProduct(value);

          return {
            ...row,
            productId: value,
            productQuery: product ? getProductLabel(product) : "",
            purchasePrice: product ? String(product.purchasePrice) : ""
          };
        }

        return {
          ...row,
          [field]: value
        };
      })
    );
  };

  const addRow = () => {
    setDraftRows((rows) => [...rows, createDraftRow()]);
  };

  const focusLastDraftProduct = () => {
    window.setTimeout(() => {
      const productInputs = document.querySelectorAll("[data-draft-product-input]");
      productInputs[productInputs.length - 1]?.focus();
    }, 0);
  };

  const handleRegisterKeyDown = (e) => {
    if (e.key !== "Enter" || !e.target.matches("[data-register-input]")) {
      return;
    }

    e.preventDefault();

    const controls = Array.from(
      e.currentTarget.querySelectorAll("[data-register-input]")
    ).filter((control) => !control.disabled);
    const currentIndex = controls.indexOf(e.target);
    const nextControl = controls[currentIndex + 1];

    if (nextControl) {
      nextControl.focus();
      return;
    }

    addRow();
    focusLastDraftProduct();
  };

  const removeRow = (rowId) => {
    setDraftRows((rows) => {
      const nextRows = rows.filter((row) => row.id !== rowId);
      return nextRows.length ? nextRows : [createDraftRow()];
    });
  };

  const validateRows = (rowsToValidate = draftRows) => {
    const completedRows = rowsToValidate.filter(
      (row) => row.productId || row.productQuery || row.sellingPrice
    );

    if (!completedRows.length) {
      return {
        valid: false,
        message: "Add at least one sale row before saving."
      };
    }

    const incompleteRow = completedRows.find((row) => {
      const isManual = row.productQuery.trim() && !row.productId;

      if (
        !row.quantity ||
        Number(row.quantity) < 1 ||
        !row.sellingPrice ||
        Number(row.sellingPrice) <= 0
      ) {
        return true;
      }

      if (isManual) {
        return !row.productQuery.trim() ||
          !row.purchasePrice ||
          Number(row.purchasePrice) <= 0;
      }

      return !row.productId;
    });

    if (incompleteRow) {
      return {
        valid: false,
        message: "Complete product, purchase price when needed, quantity, selling price and payment for every sale row."
      };
    }

    const stockErrors = completedRows.filter((row) => row.productId).some((row) => {
      const product = getProduct(row.productId);
      const requestedPairs = completedRows.filter(
        (item) => item.productId === row.productId
      ).reduce((sum, item) => sum + Number(item.quantity || 1), 0);

      return !product || requestedPairs > getProductQuantity(product);
    });

    if (stockErrors) {
      return {
        valid: false,
        message: "One or more product quantities exceed available stock."
      };
    }

    const paymentError = completedRows
      .map((row) => {
        const rowNumber = draftRows.findIndex((draftRow) => draftRow.id === row.id) + 1;
        const totalAmount = Number(row.sellingPrice) * Number(row.quantity);
        const cashAmount = Number(row.cashAmount || 0);
        const gpayAmount = Number(row.gpayAmount || 0);
        const cardAmount = Number(row.cardAmount || 0);
        const paidAmount = cashAmount + gpayAmount + cardAmount;

        return {
          rowNumber,
          totalAmount,
          cashAmount,
          gpayAmount,
          cardAmount,
          paidAmount
        };
      })
      .find((row) => row.paidAmount !== row.totalAmount);

    if (paymentError) {
      return {
        valid: false,
        message:
          `Row ${sales.length + paymentError.rowNumber}: payment is ${formatCurrency(paymentError.paidAmount)} ` +
          `but row total is ${formatCurrency(paymentError.totalAmount)}. ` +
          `Cash ${formatCurrency(paymentError.cashAmount)} + ` +
          `GPay ${formatCurrency(paymentError.gpayAmount)} + ` +
          `Card ${formatCurrency(paymentError.cardAmount)} must equal ` +
          `Selling Price x Qty.`
      };
    }

    return {
      valid: true,
      rows: completedRows
    };
  };

  const buildSalePayload = (row) => ({
    productId: row.productId || undefined,
    productName: row.productId ? undefined : row.productQuery.trim(),
    quantity: Number(row.quantity),
    purchasePrice: row.productId ? undefined : Number(row.purchasePrice),
    sellingPrice: Number(row.sellingPrice),
    notes: row.notes,
    paymentBreakdown: {
      cash: Number(row.cashAmount || 0),
      gpay: Number(row.gpayAmount || 0),
      card: Number(row.cardAmount || 0)
    }
  });

  const saveAllSales = async () => {
    setMessage("");

    const validation = validateRows();

    if (!validation.valid) {
      setMessage(validation.message);
      return;
    }

    setIsSaving(true);

    try {
      await api.post("/sales/bulk", {
        saleDate: selectedDate,
        sales: validation.rows.map(buildSalePayload)
      });

      await Promise.all([
        fetchSales(selectedDate),
        fetchProducts(),
        fetchExpenses(selectedDate),
        fetchPaymentTransfers(selectedDate)
      ]);
      setDraftRows([createDraftRow()]);
      setMessage("All sales saved and inventory updated.");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to save all rows. Check stock and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraftSale = async (rowId) => {
    setMessage("");

    const row = draftRows.find((draftRow) => draftRow.id === rowId);
    const validation = validateRows(row ? [row] : []);

    if (!validation.valid) {
      setMessage(validation.message);
      return;
    }

    setIsSaving(true);

    try {
      await api.post("/sales/bulk", {
        saleDate: selectedDate,
        sales: validation.rows.map(buildSalePayload)
      });

      await Promise.all([
        fetchSales(selectedDate),
        fetchProducts(),
        fetchExpenses(selectedDate),
        fetchPaymentTransfers(selectedDate)
      ]);
      setDraftRows((rows) => {
        const nextRows = rows.filter((draftRow) => draftRow.id !== rowId);
        return nextRows.length ? nextRows : [createDraftRow()];
      });
      setMessage("Sale saved and inventory updated.");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Unable to save this row. Check stock and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSavedSale = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) {
      return;
    }

    try {
      await api.delete(`/sales/${saleId}`);
      await Promise.all([
        fetchSales(selectedDate),
        fetchProducts(),
        fetchExpenses(selectedDate),
        fetchPaymentTransfers(selectedDate)
      ]);
      setMessage("Sale deleted and inventory restored.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete sale.");
    }
  };

  const persistSaleOrder = async (nextSales) => {
    try {
      await api.patch("/sales/order", {
        saleIds: nextSales.map((sale) => sale._id)
      });
    } catch (error) {
      await fetchSales(selectedDate);
      setMessage(error.response?.data?.message || "Unable to update sale order.");
    }
  };

  const reorderSavedSale = async (fromIndex, toIndex) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= sales.length ||
      toIndex >= sales.length
    ) {
      return;
    }

    const nextSales = [...sales];
    const [movedSale] = nextSales.splice(fromIndex, 1);
    nextSales.splice(toIndex, 0, movedSale);
    setSales(nextSales);
    setMessage("");
    await persistSaleOrder(nextSales);
  };

  const handleSavedSaleDragStart = (e, saleId) => {
    setDraggedSaleId(saleId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", saleId);
  };

  const handleSavedSaleDragOver = (e, saleId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (saleId !== dragOverSaleId) {
      setDragOverSaleId(saleId);
    }
  };

  const handleSavedSaleDrop = async (e, targetSaleId) => {
    e.preventDefault();
    const sourceSaleId = draggedSaleId || e.dataTransfer.getData("text/plain");
    setDraggedSaleId("");
    setDragOverSaleId("");

    if (!sourceSaleId || sourceSaleId === targetSaleId) {
      return;
    }

    const fromIndex = sales.findIndex((sale) => sale._id === sourceSaleId);
    const toIndex = sales.findIndex((sale) => sale._id === targetSaleId);

    await reorderSavedSale(fromIndex, toIndex);
  };

  const handleSavedSaleDragEnd = () => {
    setDraggedSaleId("");
    setDragOverSaleId("");
  };

  const openEditSale = (sale) => {
    setEditingSale(sale);
    setEditForm({
      productId: sale.productId || "",
      productName: sale.productName || "",
      quantity: String(sale.quantity),
      purchasePrice: String(sale.purchasePrice),
      sellingPrice: String(sale.sellingPrice),
      cashAmount: String(sale.paymentBreakdown?.cash || 0),
      gpayAmount: String(sale.paymentBreakdown?.gpay || 0),
      cardAmount: String(sale.paymentBreakdown?.card || 0),
      notes: sale.notes || ""
    });
  };

  const selectedEditProduct = products.find(
    (product) => product._id === editForm.productId
  );

  const handleEditProductChange = (nextProductId) => {
    setEditForm({
      ...editForm,
      productId: nextProductId
    });
  };

  const saveEditedSale = async (e) => {
    e.preventDefault();
    setMessage("");
    const isManualEdit = !editForm.productId;

    try {
      await api.put(`/sales/${editingSale._id}`, {
        productId: isManualEdit ? undefined : editForm.productId,
        productName: isManualEdit ? editForm.productName.trim() : undefined,
        quantity: Number(editForm.quantity),
        purchasePrice: isManualEdit ? Number(editForm.purchasePrice) : undefined,
        sellingPrice: Number(editForm.sellingPrice),
        notes: isManualEdit ? editForm.notes : undefined,
        paymentBreakdown: {
          cash: Number(editForm.cashAmount || 0),
          gpay: Number(editForm.gpayAmount || 0),
          card: Number(editForm.cardAmount || 0)
        }
      });

      setEditingSale(null);
      await Promise.all([
        fetchSales(selectedDate),
        fetchProducts(),
        fetchExpenses(selectedDate),
        fetchPaymentTransfers(selectedDate)
      ]);
      setMessage("Sale updated and inventory adjusted.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update sale.");
    }
  };

  const savePaymentTransfer = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      await api.post("/payment-transfers", {
        ...transferForm,
        date: selectedDate,
        amount: Number(transferForm.amount)
      });
      await fetchPaymentTransfers(selectedDate);
      setTransferForm({ direction: "cash-to-gpay", amount: "", notes: "" });
      setMessage("Payment transfer saved.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save payment transfer.");
    }
  };

  const deletePaymentTransfer = async (transferId) => {
    if (!window.confirm("Are you sure you want to delete this transfer?")) {
      return;
    }

    try {
      await api.delete(`/payment-transfers/${transferId}`);
      await fetchPaymentTransfers(selectedDate);
      setMessage("Payment transfer deleted.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete payment transfer.");
    }
  };

  const renderDraftCard = (row, index) => {
    const product = getProduct(row.productId);
    const paymentLabel = [
      Number(row.cashAmount) > 0 ? "Cash" : null,
      Number(row.gpayAmount) > 0 ? "GPay" : null,
      Number(row.cardAmount) > 0 ? "Card" : null
    ].filter(Boolean);

    return (
      <article className="sales-entry-card draft-entry-card" key={row.id}>
        <div className="card-topline">
          <strong>Sale #{sales.length + index + 1}</strong>
          <span className="payment-badge">
            {paymentLabel.length > 2 ? "Mixed" : paymentLabel.join(" + ") || "Unpaid"}
          </span>
        </div>
        <div className="mobile-form-grid">
          <label>
            Product
            <input
              data-draft-product-input
              list="daily-sales-products"
              value={row.productQuery}
              placeholder="Type product"
              onChange={(e) => updateDraftRow(row.id, "productQuery", e.target.value)}
            />
          </label>
          <label>
            Color
            <input value={product?.color || ""} readOnly />
          </label>
          <label>
            Qty
            <input
              type="number"
              min="1"
              value={row.quantity}
              onChange={(e) => updateDraftRow(row.id, "quantity", e.target.value)}
            />
          </label>
          <label>
            Purchase Price
            <input
              type="number"
              min="0"
              value={row.productId ? product?.purchasePrice || "" : row.purchasePrice}
              readOnly={Boolean(row.productId)}
              onChange={(e) => updateDraftRow(row.id, "purchasePrice", e.target.value)}
            />
          </label>
          <label>
            Selling Price
            <input
              type="number"
              min="0"
              value={row.sellingPrice}
              onChange={(e) => updateDraftRow(row.id, "sellingPrice", e.target.value)}
            />
          </label>
          <label>
            Cash
            <input
              type="number"
              min="0"
              value={row.cashAmount}
              disabled={isPaymentFieldDisabled(row, "cashAmount")}
              onChange={(e) => updateDraftRow(row.id, "cashAmount", e.target.value)}
            />
          </label>
          <label>
            GPay
            <input
              type="number"
              min="0"
              value={row.gpayAmount}
              disabled={isPaymentFieldDisabled(row, "gpayAmount")}
              onChange={(e) => updateDraftRow(row.id, "gpayAmount", e.target.value)}
            />
          </label>
          <label>
            Card
            <input
              type="number"
              min="0"
              value={row.cardAmount}
              disabled={isPaymentFieldDisabled(row, "cardAmount")}
              onChange={(e) => updateDraftRow(row.id, "cardAmount", e.target.value)}
            />
          </label>
          <label className="form-wide">
            Notes
            <input
              value={row.notes}
              onChange={(e) => updateDraftRow(row.id, "notes", e.target.value)}
            />
          </label>
        </div>
        <div className="card-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => saveDraftSale(row.id)}
            disabled={isSaving}
          >
            Save Sale
          </button>
          <button
            className="ghost-button danger"
            type="button"
            onClick={() => removeRow(row.id)}
          >
            Remove
          </button>
        </div>
      </article>
    );
  };

  return (
    <main className="page-shell sales-register">
      <section className="page-header register-header">
        <div className="register-controls">
          <label>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
        </div>
      </section>

      {message && <p className="status-message">{message}</p>}

      <datalist id="daily-sales-products">
        {productOptions.map((product) => (
          <option key={product._id} value={getProductLabel(product)} />
        ))}
      </datalist>

      <section className="panel register-panel paper-register">
        <div className="register-toolbar">
          <button className="secondary-button" type="button" onClick={addRow}>
            Add Row
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={saveAllSales}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save All Sales"}
          </button>
        </div>

        <div className="table-wrap">
          <table
            className="sales-table register-table"
            onKeyDown={handleRegisterKeyDown}
          >
            <thead>
              <tr>
                <th>S.No</th>
                <th>Product</th>
                <th>Color</th>
                <th>Qty</th>
                <th>Purchase Price</th>
                <th className="selling-price-cell">Selling Price</th>
                <th>Cash</th>
                <th>GPay</th>
                <th>Card</th>
                <th>Payment</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, index) => (
                <tr
                  className={`saved-row ${
                    draggedSaleId === sale._id ? "dragging" : ""
                  } ${dragOverSaleId === sale._id ? "drag-over" : ""}`}
                  draggable
                  key={sale._id}
                  onDragStart={(e) => handleSavedSaleDragStart(e, sale._id)}
                  onDragOver={(e) => handleSavedSaleDragOver(e, sale._id)}
                  onDrop={(e) => handleSavedSaleDrop(e, sale._id)}
                  onDragEnd={handleSavedSaleDragEnd}
                >
                  <td>
                    <span className="drag-handle" title="Drag this row to reorder">
                      {"\u22EE"}
                    </span>
                    <span className="row-number">{index + 1}</span>
                  </td>
                  <td>{sale.productName}</td>
                  <td>{sale.color}</td>
                  <td>{sale.quantity}</td>
                  <td>{formatCurrency(sale.purchasePrice)}</td>
                  <td className="selling-price-cell">{formatCurrency(sale.sellingPrice)}</td>
                  <td>{formatCurrency(sale.paymentBreakdown?.cash || 0)}</td>
                  <td>{formatCurrency(sale.paymentBreakdown?.gpay || 0)}</td>
                  <td>{formatCurrency(sale.paymentBreakdown?.card || 0)}</td>
                  <td>
                    <span className="payment-badge">{getPaymentLabel(sale)}</span>
                  </td>
                  <td>{sale.notes || ""}</td>
                  <td className="table-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => openEditSale(sale)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button danger"
                      type="button"
                      onClick={() => deleteSavedSale(sale._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {draftRows.map((row, index) => {
                const product = getProduct(row.productId);
                return (
                  <tr className="draft-row" key={row.id}>
                    <td>{sales.length + index + 1}</td>
                    <td>
                      <input
                        data-draft-product-input
                        data-register-input
                        list="daily-sales-products"
                        value={row.productQuery}
                        placeholder="Type product"
                        onChange={(e) =>
                          updateDraftRow(row.id, "productQuery", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input value={product?.color || ""} readOnly />
                    </td>
                    <td>
                      <input
                        data-register-input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) =>
                          updateDraftRow(row.id, "quantity", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        data-register-input
                        type="number"
                        min="0"
                        value={row.productId ? product?.purchasePrice || "" : row.purchasePrice}
                        readOnly={Boolean(row.productId)}
                        onChange={(e) =>
                          updateDraftRow(row.id, "purchasePrice", e.target.value)
                        }
                      />
                    </td>
                    <td className="selling-price-cell">
                      <input
                        data-register-input
                        type="number"
                        min="0"
                        value={row.sellingPrice}
                        onChange={(e) =>
                          updateDraftRow(row.id, "sellingPrice", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        data-register-input
                        type="number"
                        min="0"
                        value={row.cashAmount}
                        disabled={isPaymentFieldDisabled(row, "cashAmount")}
                        onChange={(e) =>
                          updateDraftRow(row.id, "cashAmount", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        data-register-input
                        type="number"
                        min="0"
                        value={row.gpayAmount}
                        disabled={isPaymentFieldDisabled(row, "gpayAmount")}
                        onChange={(e) =>
                          updateDraftRow(row.id, "gpayAmount", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        data-register-input
                        type="number"
                        min="0"
                        value={row.cardAmount}
                        disabled={isPaymentFieldDisabled(row, "cardAmount")}
                        onChange={(e) =>
                          updateDraftRow(row.id, "cardAmount", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <span className="payment-badge">
                        {[
                          Number(row.cashAmount) > 0 ? "Cash" : null,
                          Number(row.gpayAmount) > 0 ? "GPay" : null,
                          Number(row.cardAmount) > 0 ? "Card" : null
                        ].filter(Boolean).length > 2
                          ? "Mixed"
                          : [
                              Number(row.cashAmount) > 0 ? "Cash" : null,
                              Number(row.gpayAmount) > 0 ? "GPay" : null,
                              Number(row.cardAmount) > 0 ? "Card" : null
                            ].filter(Boolean).join(" + ") || "Unpaid"}
                      </span>
                    </td>
                    <td>
                      <input
                        data-register-input
                        value={row.notes}
                        onChange={(e) =>
                          updateDraftRow(row.id, "notes", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => saveDraftSale(row.id)}
                          disabled={isSaving}
                        >
                          Save Sale
                        </button>
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobile-sales-list">
          {sales.map((sale, index) => (
            <article className="sales-entry-card" key={sale._id}>
              <div className="card-topline">
                <div>
                  <strong>#{index + 1} {sale.productName}</strong>
                  <span>{sale.color || "-"}</span>
                </div>
                <span className="payment-badge">{getPaymentLabel(sale)}</span>
              </div>
              <div className="data-card-grid">
                <div>
                  <span>Qty</span>
                  <strong>{sale.quantity}</strong>
                </div>
                <div>
                  <span>Purchase</span>
                  <strong>{formatCurrency(sale.purchasePrice)}</strong>
                </div>
                <div>
                  <span>Selling</span>
                  <strong>{formatCurrency(sale.sellingPrice)}</strong>
                </div>
                <div>
                  <span>Cash</span>
                  <strong>{formatCurrency(sale.paymentBreakdown?.cash || 0)}</strong>
                </div>
                <div>
                  <span>GPay</span>
                  <strong>{formatCurrency(sale.paymentBreakdown?.gpay || 0)}</strong>
                </div>
                <div>
                  <span>Card</span>
                  <strong>{formatCurrency(sale.paymentBreakdown?.card || 0)}</strong>
                </div>
              </div>
              {sale.notes && <p className="muted">{sale.notes}</p>}
              <div className="card-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => openEditSale(sale)}
                >
                  Edit
                </button>
                <button
                  className="ghost-button danger"
                  type="button"
                  onClick={() => deleteSavedSale(sale._id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {draftRows.map(renderDraftCard)}
        </div>
      </section>

      <section className="register-totals">
        <article>
          <span>Total Sale</span>
          <strong>{formatCurrency(totals.totalSales)}</strong>
        </article>
        <article>
          <span>Total Expense</span>
          <strong>{formatCurrency(totals.totalExpenses)}</strong>
        </article>
        <article>
          <span>Balance Amount</span>
          <strong>{formatCurrency(totals.balanceAmount)}</strong>
          <div className="balance-breakdown">
            <span>GPay {formatCurrency(totals.gpayBalance)}</span>
          <span>Cash {formatCurrency(totals.cashBalance)}</span>
        </div>
        </article>
      </section>

      <section className="panel transfer-panel">
        <form className="transfer-form" onSubmit={savePaymentTransfer}>
          <label>
            Transfer
            <select
              value={transferForm.direction}
              onChange={(e) =>
                setTransferForm({ ...transferForm, direction: e.target.value })
              }
            >
              <option value="cash-to-gpay">Cash to GPay</option>
              <option value="gpay-to-cash">GPay to Cash</option>
            </select>
          </label>
          <label>
            Amount
            <input
              type="number"
              min="1"
              value={transferForm.amount}
              onChange={(e) =>
                setTransferForm({ ...transferForm, amount: e.target.value })
              }
              required
            />
          </label>
          <label>
            Notes
            <input
              value={transferForm.notes}
              onChange={(e) =>
                setTransferForm({ ...transferForm, notes: e.target.value })
              }
            />
          </label>
          <button className="primary-button" type="submit">
            Save Transfer
          </button>
        </form>

        {paymentTransfers.length > 0 && (
          <div className="transfer-list">
            {paymentTransfers.map((transfer) => (
              <article key={transfer._id}>
                <div>
                  <strong>
                    {transfer.direction === "cash-to-gpay"
                      ? "Cash to GPay"
                      : "GPay to Cash"}
                  </strong>
                  {transfer.notes && <span>{transfer.notes}</span>}
                </div>
                <strong>{formatCurrency(transfer.amount)}</strong>
                <button
                  className="ghost-button danger"
                  type="button"
                  onClick={() => deletePaymentTransfer(transfer._id)}
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {editingSale && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="section-heading">
              <h2>Edit Sale</h2>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setEditingSale(null)}
              >
                Close
              </button>
            </div>

            <form className="product-form register-form" onSubmit={saveEditedSale}>
              {editForm.productId ? (
                <>
                  <label>
                    Product
                    <select
                      value={editForm.productId}
                      onChange={(e) => handleEditProductChange(e.target.value)}
                      required
                    >
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {getProductName(product)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Color
                    <input value={selectedEditProduct?.color || ""} readOnly />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Product Name
                    <input
                      value={editForm.productName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, productName: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Purchase Price
                    <input
                      type="number"
                      min="0"
                      value={editForm.purchasePrice}
                      onChange={(e) =>
                        setEditForm({ ...editForm, purchasePrice: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Notes
                    <input
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, notes: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) =>
                    setEditForm({ ...editForm, quantity: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Selling Price
                <input
                  type="number"
                  min="0"
                  value={editForm.sellingPrice}
                  onChange={(e) =>
                    setEditForm({ ...editForm, sellingPrice: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Cash Amount
                <input
                  type="number"
                  min="0"
                  value={editForm.cashAmount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cashAmount: e.target.value })
                  }
                />
              </label>

              <label>
                GPay Amount
                <input
                  type="number"
                  min="0"
                  value={editForm.gpayAmount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, gpayAmount: e.target.value })
                  }
                />
              </label>

              <label>
                Card Amount
                <input
                  type="number"
                  min="0"
                  value={editForm.cardAmount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cardAmount: e.target.value })
                  }
                />
              </label>

              <button className="primary-button" type="submit">
                Update Sale
              </button>
            </form>
          </div>
        </div>
      )}
  </main>
  );
}

export default DailySales;
