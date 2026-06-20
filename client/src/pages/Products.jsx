import { useEffect, useState } from "react";
import api from "../services/api";

const emptyForm = {
  brand: "",
  articleNumber: "",
  color: "",
  purchasePrice: "",
  quantity: ""
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const getProductName = (product) =>
  product.brand && product.articleNumber
    ? `${product.brand}-${product.articleNumber}`
    : product.name || "";

const getProductQuantity = (product) =>
  product.quantity ??
  product.sizes?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ??
  0;

function Products({ isActive, onNavigate }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter((product) => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      (product.brand || "").toLowerCase().includes(query) ||
      (product.articleNumber || "").toLowerCase().includes(query) ||
      getProductName(product).toLowerCase().includes(query) ||
      product.color.toLowerCase().includes(query)
    );
  });
  const isSearching = searchTerm.trim().length > 0;

  const fetchProducts = async () => {
    const res = await api.get("/products");
    setProducts(res.data);
  };

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    api.get("/products").then((res) => {
      if (!ignore) {
        setProducts(res.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [isActive]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleProductFormKeyDown = (e) => {
    if (e.key !== "Enter" || !e.target.matches("[data-product-input]")) {
      return;
    }

    e.preventDefault();

    const controls = Array.from(
      e.currentTarget.querySelectorAll("[data-product-input]")
    ).filter((control) => !control.disabled);
    const currentIndex = controls.indexOf(e.target);
    const nextControl = controls[currentIndex + 1];

    if (nextControl) {
      nextControl.focus();
      return;
    }

    e.currentTarget.requestSubmit();
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setMessage("");

    const quantity = Number(form.quantity);

    if (Number.isNaN(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      setMessage("Quantity must be a whole number and cannot be negative.");
      return;
    }

    const payload = {
      brand: form.brand.trim(),
      articleNumber: form.articleNumber.trim(),
      color: form.color.trim(),
      purchasePrice: Number(form.purchasePrice),
      quantity
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        setMessage("Product updated.");
      } else {
        await api.post("/products", payload);
        setMessage("Product added.");
      }

      resetForm();
      fetchProducts();
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to save product.");
    }
  };

  const editProduct = (product) => {
    setEditingId(product._id);
    setForm({
      brand: product.brand || product.name || "",
      articleNumber: product.articleNumber || "NA",
      color: product.color,
      purchasePrice: String(product.purchasePrice),
      quantity: String(getProductQuantity(product))
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    await api.delete(`/products/${id}`);
    fetchProducts();
  };

  const renderProductsGrid = () => (
    <section className="products-grid">
      {filteredProducts.map((product) => (
        <article className="product-card" key={product._id}>
          <div className="card-topline">
            <div>
              <h2>{getProductName(product)}</h2>
              <p>{product.color}</p>
            </div>
            <strong>{formatCurrency(product.purchasePrice)}</strong>
          </div>

          <div className="stock-total">
            <span>Quantity</span>
            <strong>{getProductQuantity(product)}</strong>
          </div>

          <div className="card-actions">
            <button className="secondary-button" onClick={() => editProduct(product)}>
              Edit
            </button>
            <button className="secondary-button" onClick={() => editProduct(product)}>
              Edit Stock
            </button>
            <button
              className="ghost-button danger"
              onClick={() => deleteProduct(product._id)}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );

  return (
    <main className="page-shell">
      <section className="panel compact-panel">
        <div className="inventory-toolbar">
          <label>
            Search Inventory
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by brand, article number or color"
            />
          </label>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onNavigate?.("importStock")}
          >
            Import Stock
          </button>
        </div>
      </section>

      {isSearching && renderProductsGrid()}

      <section className="panel">
        <div className="section-heading">
          <h2>{editingId ? "Edit Product" : "Add Product"}</h2>
          {editingId && (
            <button className="ghost-button" type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>

        <form
          className="product-form"
          onSubmit={saveProduct}
          onKeyDown={handleProductFormKeyDown}
        >
          <label>
            Brand
            <input
              data-product-input
              name="brand"
              value={form.brand}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Article Number
            <input
              data-product-input
              name="articleNumber"
              value={form.articleNumber}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Color
            <input
              data-product-input
              name="color"
              value={form.color}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Purchase Price
            <input
              data-product-input
              type="number"
              min="0"
              name="purchasePrice"
              value={form.purchasePrice}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Quantity
            <input
              data-product-input
              type="number"
              min="0"
              step="1"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              required
            />
          </label>

          <button className="primary-button" type="submit">
            {editingId ? "Update Product" : "Add Product"}
          </button>
        </form>

        {message && <p className="status-message">{message}</p>}
      </section>

      {!isSearching && renderProductsGrid()}
    </main>
  );
}

export default Products;
