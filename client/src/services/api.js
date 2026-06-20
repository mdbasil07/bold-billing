import axios from "axios";

const apiOrigin = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(
  /\/+$/,
  ""
);

const api = axios.create({
  baseURL: `${apiOrigin}/api`
});

export default api;
