import React, { useState } from "react";
import SetupPage from "./pages/SetupPage";
import ViewPage from "./pages/ViewPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./AuthContext";
import { generateFull } from "./api";

export default function App() {
  const { authenticated, loading, logoutUser, username } = useAuth();

  const [mode, setMode] = useState<"setup" | "view" | "admin">("setup");
  const [genData, setGenData] = useState<any>(null);

  if (loading) return <div className="p-6">Checking authentication...</div>;

  if (!authenticated) return <LoginPage />;

  return (
    <div>
      <div className="p-3 flex justify-between border-b border-black">
        <div className="flex gap-2">
          <button onClick={() => setMode("setup")} className="border px-3 py-1 text-sm">
            Setup
          </button>
          <button onClick={() => setMode("admin")} className="border px-3 py-1 text-sm">
            Admin
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div>Logged in as: <b>{username}</b></div>
          <button onClick={logoutUser} className="border px-3 py-1">
            Logout
          </button>
        </div>
      </div>

      {mode === "setup" && (
        <SetupPage
          onReadyGenerate={async (branchIds, config) => {
            const data = await generateFull(branchIds, config);
            setGenData(data);
            setMode("view");
          }}
        />
      )}

      {mode === "view" && <ViewPage data={genData} onBack={() => setMode("setup")} />}
      {mode === "admin" && <AdminPage />}
    </div>
  );
}