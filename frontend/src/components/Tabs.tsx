import React from "react";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded border text-sm ${
            active === t ? "bg-black text-white border-black" : "bg-white border-black"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
