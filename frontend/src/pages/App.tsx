import { useState } from "react";
import "../styles/App.css";
import ApiRequest from "../components/apiRequest";

function App() {
  const [urlInput, setUrlInput] = useState<string>("/api/Data/current");
  const [requestUrl, setRequestUrl] = useState<string | null>(null);

  return (
    <>
      <title>Aethernet</title>
      <h1>Aethernet</h1>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>Request URL:</label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          style={{ width: 400 }}
        />
        <button
          style={{ marginLeft: 8 }}
          onClick={() => setRequestUrl(urlInput)}
        >
          Load
        </button>
      </div>

      {requestUrl ? (
        <ApiRequest requestUrl={requestUrl} />
      ) : (
        <div>Enter a URL and click Load to view cauldron data.</div>
      )}
    </>
  );
}

export default App;
