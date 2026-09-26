import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./App.css";
import { AdminPage } from "./ui/AdminPage";
import { GuidePage } from "./ui/GuidePage";
import { TrainPage } from "./ui/TrainPage";

const App = () => (
  <HashRouter>
    <Routes>
      <Route path="/" element={<GuidePage />} />
      <Route path="/train" element={<TrainPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </HashRouter>
);

export default App;
