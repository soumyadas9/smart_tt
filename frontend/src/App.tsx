import React, { useState } from "react";
import SetupPage from "./pages/SetupPage";
import ViewPage from "./pages/ViewPage";
import { generateFull } from "./api";


export default function App() {
  const [mode, setMode] = useState<"setup"|"view">("setup");
  const [genData, setGenData] = useState<any>(null);

  return mode === "setup" ? (
    <SetupPage
      onReadyGenerate={async (branchIds) => {
  try {
    const data = await generateFull(branchIds);
    setGenData(data);
    setMode("view");
  } catch (e: any) {
    alert(e?.message ?? "Generate failed.");
  }
}}

    />
  ) : (
    <ViewPage
      data={genData}
      onBack={()=>setMode("setup")}
    />
  );
}
