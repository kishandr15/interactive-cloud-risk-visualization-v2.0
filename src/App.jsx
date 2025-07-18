import React from "react";
import Graph from "./components/Graph";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">
        Distribution of Open Alerts & Misconfigurations
      </h1>
      <Graph />
    </div>
  );
}

export default App;