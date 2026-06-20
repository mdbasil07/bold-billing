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

const getProductName = (product) =>
  product.brand && product.articleNumber
    ? `${product.brand}-${product.articleNumber}`
    : product.name || "";

function SalesHistory({ isActive }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterMode, setFilterMode] = useState("today");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [productId, setProductId] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
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
  const [message, setMessage] = useState("");

  const fetchSales = async () => {
    const params = new URLSearchParams();

    if (filterMode === "today") {
      params.set("date", today());
    }

    if (filterMode === "range") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }

    if (productId) {
      params.set("productId", productId);
    }

    const res = await api.get(`/sales?${params.toString()}`);
    setSales(res.data);
  };

  const fetchProducts = async () => {
    const res = await api.get("/products");
    setProducts(res.data);
  };

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;
    const params = new URLSearchParams();

    if (filterMode === "today") {
      params.set("date", today());
    }

    if (filterMode === "range") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }

    if (productId) {
      params.set("productId", productId);
    }

    Promise.all([
      api.get(`/sales?${params.toString()}`),
      api.get("/products")
    ]).then(([salesRes, productsRes]) => {
      if (!ignore) {
        setSales(salesRes.data);
        setProducts(productsRes.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive, filterMode, startDate, endDate, productId]);

  const deleteSale = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) {
      return;
    }

    await api.delete(`/sales/${saleId}`);
    setMessage("Sale deleted and inventory restored.");
    await Promise.all([fetchSales(), fetchProducts()]);
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
      setMessage("Sale updated and inventory adjusted.");
      await Promise.all([fetchSales(), fetchProducts()]);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update sale.");
    }
  };

  return (
    <main className="page-shell">
      <section className="panel compact-panel history-filters">
        <label>
          Filter
          <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
            <option value="today">Today</option>
            <option value="range">Date Range</option>
          </select>
        </label>

        {filterMode === "range" && (
          <>
            <label>
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        )}

        <label>
          Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {getProductName(product)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {message && <p className="status-message">{message}</p>}

      <section className="panel register-panel">
        <div className="table-wrap">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product Name</th>
                <th>Color</th>
                <th>Quantity</th>
                <th>Purchase Price</th>
                <th>Selling Price</th>
                <th>Profit</th>
                <th>Payment Method</th>
                <th>Cash</th>
                <th>GPay</th>
                <th>Card</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="13" className="empty-cell">
                    No sales found.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td>{sale.productName}</td>
                    <td>{sale.color || "-"}</td>
                    <td>{sale.quantity}</td>
                    <td>{formatCurrency(sale.purchasePrice)}</td>
                    <td>{formatCurrency(sale.sellingPrice)}</td>
                    <td>{formatCurrency(sale.profit)}</td>
                    <td>{sale.paymentMethod}</td>
                    <td>{formatCurrency(sale.paymentBreakdown?.cash || 0)}</td>
                    <td>{formatCurrency(sale.paymentBreakdown?.gpay || 0)}</td>
                    <td>{formatCurrency(sale.paymentBreakdown?.card || 0)}</td>
                    <td>{sale.notes || ""}</td>
                    <td className="table-actions">
                      <button className="secondary-button" onClick={() => setSelectedSale(sale)}>
                        View
                      </button>
                      <button className="secondary-button" onClick={() => openEditSale(sale)}>
                        Edit
                      </button>
                      <button className="ghost-button danger" onClick={() => deleteSale(sale._id)}>
                        Delete Sale
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSale && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="section-heading">
              <h2>Sale Details</h2>
              <button className="ghost-button" onClick={() => setSelectedSale(null)}>
                Close
              </button>
            </div>
            <div className="detail-grid">
              <span>Date</span>
              <strong>{formatDate(selectedSale.createdAt)}</strong>
              <span>Product</span>
              <strong>{selectedSale.productName}</strong>
              <span>Color</span>
              <strong>{selectedSale.color || "-"}</strong>
              <span>Quantity</span>
              <strong>{selectedSale.quantity}</strong>
              <span>Purchase Price</span>
              <strong>{formatCurrency(selectedSale.purchasePrice)}</strong>
              <span>Selling Price</span>
              <strong>{formatCurrency(selectedSale.sellingPrice)}</strong>
              <span>Profit</span>
              <strong>{formatCurrency(selectedSale.profit)}</strong>
              <span>Payment</span>
              <strong>{selectedSale.paymentMethod}</strong>
              <span>Cash</span>
              <strong>{formatCurrency(selectedSale.paymentBreakdown?.cash || 0)}</strong>
              <span>GPay</span>
              <strong>{formatCurrency(selectedSale.paymentBreakdown?.gpay || 0)}</strong>
              <span>Card</span>
              <strong>{formatCurrency(selectedSale.paymentBreakdown?.card || 0)}</strong>
              <span>Notes</span>
              <strong>{selectedSale.notes || "-"}</strong>
            </div>
          </div>
        </div>
      )}

      {editingSale && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="section-heading">
              <h2>Edit Sale</h2>
              <button className="ghost-button" onClick={() => setEditingSale(null)}>
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

export default SalesHistory;
