import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const STATUS = {
  new: "\u2713 New Product",
  exists: "\u26A0 Product Already Exists",
  invalid: "\u26A0 Invalid Row"
};

const emptyRow = () => ({
  id: crypto.randomUUID(),
  brand: "",
  articleNumber: "",
  color: "",
  purchasePrice: "",
  quantity: "",
  sourceError: ""
});

const normalizeText = (value) => String(value || "").trim().toUpperCase();

const getProductKey = (product) =>
  [
    normalizeText(product.brand || product.name),
    normalizeText(product.articleNumber || "NA"),
    normalizeText(product.color)
  ].join("|");

const getRowKey = (row) =>
  [
    normalizeText(row.brand),
    normalizeText(row.articleNumber),
    normalizeText(row.color)
  ].join("|");

function ImportStock({ isActive }) {
  const [products, setProducts] = useState([]);
  const [file, setFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [rawText, setRawText] = useState("");
  const [normalizedText, setNormalizedText] = useState("");
  const [parserErrors, setParserErrors] = useState([]);
  const [parsedRowsDebug, setParsedRowsDebug] = useState([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const existingKeys = useMemo(
    () => new Set(products.map(getProductKey)),
    [products]
  );

  const classifiedRows = useMemo(
    () =>
      rows.map((row) => {
        const errors = [];
        const exists = existingKeys.has(getRowKey(row));

        if (!normalizeText(row.brand)) errors.push("Brand missing");
        if (!normalizeText(row.articleNumber)) errors.push("Article missing");
        if (!normalizeText(row.color)) errors.push("Color missing");

        if (!exists) {
          const purchasePrice = Number(row.purchasePrice);

          if (!purchasePrice || Number.isNaN(purchasePrice) || purchasePrice <= 0) {
            errors.push("Purchase price required");
          }
        }

        const quantity = Number(row.quantity);

        if (!Number.isInteger(quantity) || quantity < 0) {
          errors.push("Quantity invalid");
        }

        if (row.sourceError) errors.push(row.sourceError);

        return {
          ...row,
          errors,
          status: errors.length ? STATUS.invalid : exists ? STATUS.exists : STATUS.new
        };
      }),
    [existingKeys, rows]
  );

  const summary = useMemo(
    () =>
      classifiedRows.reduce(
        (acc, row) => {
          if (row.errors.length) {
            acc.errors += 1;
          } else if (row.status === STATUS.exists) {
            acc.skipped += 1;
          } else {
            acc.create += 1;
          }

          return acc;
        },
        { create: 0, skipped: 0, errors: 0 }
      ),
    [classifiedRows]
  );

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

  const handleScan = async () => {
    setMessage("");
    setScanComplete(false);

    if (!file) {
      setMessage("Choose a stock sheet image or CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    setIsScanning(true);

    try {
      const res = await api.post("/import-stock/image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const parsedRows = Array.isArray(res.data) ? res.data : res.data.rows || [];

      setRows(
        parsedRows.map((row) => ({
          id: crypto.randomUUID(),
          brand: row.brand || "",
          articleNumber: row.articleNumber || "",
          color: row.color || "",
          purchasePrice: row.purchasePrice ? String(row.purchasePrice) : "",
          quantity: String(
            row.quantity ??
              Object.values(row.sizes || {}).reduce(
                (sum, value) => sum + Number(value || 0),
                0
              )
          ),
          sourceError: row.error || ""
        }))
      );
      setRawText(Array.isArray(res.data) ? "" : res.data.rawText || "");
      setNormalizedText(Array.isArray(res.data) ? "" : res.data.normalizedText || "");
      setParserErrors(Array.isArray(res.data) ? [] : res.data.parserErrors || []);
      setParsedRowsDebug(parsedRows);
      setImageName(Array.isArray(res.data) ? file.name : res.data.imageName || file.name);
      setScanComplete(true);
      setMessage(
        parsedRows.length
          ? "Stock sheet read complete. Review every row before confirming."
          : "Stock sheet read complete, but no rows were detected. Add rows manually below."
      );
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Unable to scan image."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const addRow = () => {
    setScanComplete(true);
    setRows((currentRows) => [...currentRows, emptyRow()]);
  };

  const removeRow = (rowId) => {
    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  };

  const updateRow = (rowId, field, value) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value, sourceError: "" } : row
      )
    );
  };

  const confirmImport = async () => {
    setMessage("");

    if (summary.errors > 0) {
      setMessage("Fix invalid rows before confirming import.");
      return;
    }

    const validRows = classifiedRows.filter((row) => row.status === STATUS.new);

    if (!validRows.length) {
      setMessage("No new products to import. Existing products are skipped.");
      return;
    }

    if (
      !window.confirm(
        `Confirm import for ${validRows.length} new products? Existing inventory will not be modified.`
      )
    ) {
      return;
    }

    setIsImporting(true);

    try {
      const res = await api.post("/import-stock/confirm", {
        imageName,
        rows: validRows.map((row) => ({
          brand: row.brand,
          articleNumber: row.articleNumber,
          color: row.color,
          purchasePrice: Number(row.purchasePrice),
          quantity: Number(row.quantity)
        }))
      });

      await fetchProducts();
      setRows([]);
      setFile(null);
      setRawText("");
      setNormalizedText("");
      setParserErrors([]);
      setParsedRowsDebug([]);
      setImageName("");
      setScanComplete(false);
      setMessage(
        `Import complete. New products imported ${res.data.productsCreated}, skipped ${res.data.productsSkipped || 0}.`
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to confirm import.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="page-shell import-page">
      <section className="panel import-upload-panel">
        <div className="section-heading">
          <div>
            <h2>Import Stock</h2>
            <p className="muted">Upload a handwritten stock sheet or CSV file, review it, then confirm.</p>
          </div>
        </div>

        <div className="import-controls">
          <label>
            Upload Image or CSV
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.csv,image/jpeg,image/png,text/csv"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] || null;
                setFile(selectedFile);
                setImageName(selectedFile?.name || "");
                setScanComplete(false);
                setRows([]);
                setRawText("");
                setNormalizedText("");
                setParserErrors([]);
                setParsedRowsDebug([]);
              }}
            />
          </label>

          <button
            className="primary-button"
            type="button"
            onClick={handleScan}
            disabled={isScanning}
          >
            {isScanning ? "Reading..." : "Read Stock Sheet"}
          </button>
        </div>

        {message && <p className="status-message">{message}</p>}
      </section>

      {scanComplete && (
        <>
          <section className="import-summary">
            <article>
              <span>New Products Imported</span>
              <strong>{summary.create}</strong>
            </article>
            <article>
              <span>Products Skipped</span>
              <strong>{summary.skipped}</strong>
            </article>
            <article className={summary.errors ? "summary-error" : ""}>
              <span>Invalid Rows</span>
              <strong>{summary.errors}</strong>
            </article>
          </section>

          <section className="panel register-panel">
            <div className="register-toolbar">
              <button className="secondary-button" type="button" onClick={addRow}>
                Add Row
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={confirmImport}
                disabled={isImporting || summary.create === 0 || summary.errors > 0}
              >
                {isImporting ? "Importing..." : "Confirm Import"}
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="empty-review">
                <strong>No rows detected from the image.</strong>
                <span>
                  Click Add Row and enter the stock manually, or upload a clearer
                  photo or CSV file.
                </span>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="sales-table import-table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Article Number</th>
                        <th>Color</th>
                        <th>Purchase Price</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classifiedRows.map((row) => (
                        <tr key={row.id} className={row.errors.length ? "invalid-row" : ""}>
                          <td>
                            <input
                              value={row.brand}
                              onChange={(e) => updateRow(row.id, "brand", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={row.articleNumber}
                              onChange={(e) =>
                                updateRow(row.id, "articleNumber", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={row.color}
                              onChange={(e) => updateRow(row.id, "color", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={row.purchasePrice}
                              disabled={row.status === STATUS.exists}
                              onChange={(e) =>
                                updateRow(row.id, "purchasePrice", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.quantity}
                              onChange={(e) =>
                                updateRow(row.id, "quantity", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <span className="payment-badge">{row.status}</span>
                            {row.errors.length > 0 && (
                              <small className="row-error">{row.errors.join(", ")}</small>
                            )}
                          </td>
                          <td>
                            <button
                              className="ghost-button danger"
                              type="button"
                              onClick={() => removeRow(row.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-card-list import-card-list">
                  {classifiedRows.map((row) => (
                    <article className={`data-card ${row.errors.length ? "invalid-row" : ""}`} key={row.id}>
                      <div className="card-topline">
                        <strong>{row.brand || "New row"}</strong>
                        <span className="payment-badge">{row.status}</span>
                      </div>
                      <div className="mobile-form-grid">
                        <label>
                          Brand
                          <input
                            value={row.brand}
                            onChange={(e) => updateRow(row.id, "brand", e.target.value)}
                          />
                        </label>
                        <label>
                          Article Number
                          <input
                            value={row.articleNumber}
                            onChange={(e) => updateRow(row.id, "articleNumber", e.target.value)}
                          />
                        </label>
                        <label>
                          Color
                          <input
                            value={row.color}
                            onChange={(e) => updateRow(row.id, "color", e.target.value)}
                          />
                        </label>
                        <label>
                          Purchase Price
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.purchasePrice}
                            disabled={row.status === STATUS.exists}
                            onChange={(e) => updateRow(row.id, "purchasePrice", e.target.value)}
                          />
                        </label>
                        <label>
                          Quantity
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                          />
                        </label>
                      </div>
                      {row.errors.length > 0 && (
                        <small className="row-error">{row.errors.join(", ")}</small>
                      )}
                      <button
                        className="ghost-button danger"
                        type="button"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>

          {(rawText || normalizedText || parserErrors.length > 0 || parsedRowsDebug.length > 0) && (
            <section className="panel ocr-debug-panel">
              <div className="section-heading">
                <h2>OCR Debug</h2>
              </div>

              <div className="debug-grid">
                <article>
                  <h3>Raw OCR Text</h3>
                  <pre>{rawText || "No raw OCR text returned."}</pre>
                </article>

                <article>
                  <h3>Normalized OCR Text</h3>
                  <pre>{normalizedText || "No normalized text available."}</pre>
                </article>

                <article>
                  <h3>Parsed Rows</h3>
                  <pre>{JSON.stringify(parsedRowsDebug, null, 2)}</pre>
                </article>

                <article>
                  <h3>Parser Errors</h3>
                  <pre>
                    {parserErrors.length
                      ? JSON.stringify(parserErrors, null, 2)
                      : "No parser errors."}
                  </pre>
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default ImportStock;
