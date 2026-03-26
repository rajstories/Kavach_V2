import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import CopilotPage from "./pages/CopilotPage";
import Dashboard from "./pages/Dashboard";
import IncidentDetail from "./pages/IncidentDetail";
import IncidentsPage from "./pages/IncidentsPage";
import PhishingModule from "./pages/PhishingModule";
import SimulatorPage from "./pages/SimulatorPage";
import ThreatIntelligence from "./pages/ThreatIntelligence";
import Reports from "./pages/Reports";
import SystemHealth from "./pages/SystemHealth";
import Configuration from "./pages/Configuration";
import UserManagement from "./pages/UserManagement";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/system-health" element={<SystemHealth />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/copilot" element={<CopilotPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/phishing" element={<PhishingModule />} />
      </Route>
    </Routes>
  );
}
