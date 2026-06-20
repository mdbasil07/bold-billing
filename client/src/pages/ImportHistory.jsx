import { useEffect, useState } from "react";
import api from "../services/api";

const formatDate = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

function ImportHistory({ isActive }) {
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let ignore = false;

    api.get("/import-stock/history")
      .then((res) => {
        if (!ignore) {
          setHistory(res.data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(error.response?.data?.message || "Unable to load import history.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [isActive]);

  return (
    <main className="page-shell">
      {message && <p className="status-message">{message}</p>}

      <section className="panel register-panel">
        <div className="table-wrap">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Import Date</th>
                <th>Image Name</th>
                <th>Products Created</th>
                <th>Products Skipped</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    No stock imports yet.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.imageName}</td>
                    <td>{item.productsCreated}</td>
                    <td>{item.productsSkipped || item.productsUpdated || 0}</td>
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

export default ImportHistory;
