import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/api-config";

createRoot(document.getElementById("root")!).render(<App />);
