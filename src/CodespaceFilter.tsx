import { useState } from "react";
import { Filter } from "./types.ts";
import { useCodespaces } from "./useCodespaces.ts";

export function CodespaceFilter({
  currentFilter,
  setCurrentFilter,
}: {
  setCurrentFilter: (filter: Filter) => void;
  currentFilter: Filter;
}) {
  const [selected, setSelected] = useState<string>("");

  const codespaces = useCodespaces();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelected(value);
    // Update the filter by merging the new codespaceId with any existing filter properties
    setCurrentFilter({
      ...currentFilter,
      codespaceId: value,
    });
  };

  return (
    <div style={{ padding: "10px" }}>
      <label htmlFor="codespace-select">Select Codespace:</label>
      <select id="codespace-select" value={selected} onChange={handleChange}>
        <option value="">All</option>
        {codespaces.map((cs) => (
          <option key={cs} value={cs}>
            {cs}
          </option>
        ))}
      </select>
    </div>
  );
}
