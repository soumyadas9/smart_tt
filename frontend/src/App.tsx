import React, { useState } from "react";
import SetupPage from "./pages/SetupPage";
import ViewPage from "./pages/ViewPage";
import AdminPage from "./pages/AdminPage";
import { generateFull } from "./api";

export default function App() {
  const [mode, setMode] = useState<"setup" | "view" | "admin">("setup");
  const [genData, setGenData] = useState<any>(null);

  // Simple top nav
  const TopNav = (
    <div className="p-3 flex gap-2 border-b border-black">
      <button
        className={`px-3 py-1.5 rounded border text-sm ${
          mode === "setup" ? "bg-black text-white border-black" : "bg-white border-black"
        }`}
        onClick={() => setMode("setup")}
      >
        Setup
      </button>

      <button
        className={`px-3 py-1.5 rounded border text-sm ${
          mode === "admin" ? "bg-black text-white border-black" : "bg-white border-black"
        }`}
        onClick={() => setMode("admin")}
      >
        Admin
      </button>

      {mode === "view" && (
        <button
          className="px-3 py-1.5 rounded border text-sm bg-white border-black"
          onClick={() => setMode("setup")}
        >
          Back to Setup
        </button>
      )}
    </div>
  );

  return (
    <div>
      {TopNav}

      {mode === "setup" && (
  <SetupPage
    onReadyGenerate={async (branchIds, config) => {
      try {
        const data = await generateFull(branchIds, config);
        setGenData(data);
        setMode("view");
      } catch (e: any) {
        alert(e?.message ?? "Generate failed.");
      }
    }}
  />
)}


      {mode === "view" && <ViewPage data={genData} onBack={() => setMode("setup")} />}

      {mode === "admin" && <AdminPage />}
    </div>
  );
}
