"use client";

import { useState } from "react";

export default function EtagDemo() {
  const [status, setStatus] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setStatus(null);
    setSize(null);
    setDuration(null);
    
    const startTime = performance.now();
    try {
      const res = await fetch("http://localhost:3001/api/etag-demo");
      const endTime = performance.now();
      
      const contentLength = res.headers.get("Content-Length");
      const msg = await res.text();
      
      setStatus(res.status);
      setDuration(endTime - startTime);
      
      // Note: fetch() transparently handles 304 and returns 200 with the cached body.
      // We can't easily detect 304 from fetch() status directly in browser JS without inspecting network.
      // BUT, we can infer it if we check performance or specific headers if the server exposes them.
      // However, for this demo, the user asked to show what fetch returns (which is 200) 
      // and explicitly mentioned verifying via Network Tab.
      
      // We will display the Content-Length header or the actual body size.
      if (contentLength) {
        setSize(`${(parseInt(contentLength) / 1024).toFixed(2)} KB`);
      } else {
        setSize(`${(msg.length / 1024).toFixed(2)} KB`);
      }

    } catch (error) {
      console.error(error);
      setStatus(500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl hover:border-green-500/50 transition-all mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-green-400">HTTP Caching & ETag Demo</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Demonstrates 304 Not Modified. First fetch downloads 500KB. Second fetch should send <code>If-None-Match</code> and receive 304 (0 bytes). <br/>
        <span className="text-yellow-500 font-bold">Note:</span> Browser <code>fetch()</code> API automatically handles caching and always reports status 200 to JS. 
        <span className="underline ml-1">Open Network Tab to verify 304 status!</span>
      </p>
      
      <button
        onClick={fetchData}
        disabled={loading}
        className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors mb-6"
      >
        {loading ? "Fetching..." : "Fetch Data (500KB Text)"}
      </button>

      {status !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
           <div className="bg-gray-800/50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400 mb-1">JS Status Code</p>
            <p className="text-3xl font-mono font-bold text-white">{status}</p>
            <p className="text-xs text-gray-500 mt-1">Always 200 if Cached</p>
          </div>
          
          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400 mb-1">Reacted Content Size</p>
            <p className="text-3xl font-mono font-bold text-white">{size}</p>
            <p className="text-xs text-gray-500 mt-1">Data from Cache/Server</p>
          </div>

          <div className="bg-gray-800/50 p-4 rounded-lg text-center">
             <p className="text-sm text-gray-400 mb-1">Response Time</p>
             <p className="text-3xl font-mono font-bold text-white">{duration?.toFixed(2)}ms</p>
             <p className="text-xs text-gray-500 mt-1">Faster on 304</p>
           </div>
        </div>
      )}
    </div>
  );
}
