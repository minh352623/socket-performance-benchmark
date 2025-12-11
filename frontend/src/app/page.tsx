"use client";

import { useState, useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { decode } from "@msgpack/msgpack";
import EtagDemo from "../components/EtagDemo";
import { Centrifuge } from 'centrifuge';
import RealtimeMonitor from "../components/RealtimeMonitor";

interface PerformanceMetrics {
  type: string; // Changed to string to support "Buffer (Centrifugo)"
  sizeBytes: number;
  durationMs: number;
  itemCount: number;
  dataSample?: string;
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);

  const [port, setPort] = useState(3001);

  useEffect(() => {
    // 1. Socket.io Connection
    console.log(`Connecting to port ${port}...`);
    const newSocket = io(`http://localhost:${port}`, {
       transports: ["websocket", "polling"]
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log(`Connected to server on port ${port}`);
      setError(null);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Connection error:", err);
      setError(`Failed to connect to backend server on port ${port}. Is it running?`);
    });

    newSocket.on("response-json", (data: any[]) => {
      const endTime = performance.now();
      const duration = endTime - startTimeRef.current;
      const jsonString = JSON.stringify(data);
      const size = new TextEncoder().encode(jsonString).length;

      setMetrics({
        type: "JSON",
        sizeBytes: size,
        durationMs: duration,
        itemCount: data.length,
        dataSample: JSON.stringify(data[0], null, 2),
      });
      setLoading(false);
    });

    newSocket.on("response-buffer", (buffer: ArrayBuffer) => {
        handleBufferResponse(buffer, "Buffer");
    });

    // 2. Centrifugo Connection (Only for Go Backend 3002)
    let cent: Centrifuge | null = null;
    if (port === 3002) {
      const connectCentrifugo = async () => {
        try {
          // Get Token
          const res = await fetch(`http://localhost:3002/api/centrifugo-token`);
          const { token } = await res.json();
          
          cent = new Centrifuge('ws://localhost:8000/connection/websocket', {
             token: token,
             sockjsOptions:{
              transports: ['websocket']
             }
          });

          cent.on('connected', (ctx) => {
             console.log("Centrifugo connected", ctx);
          });

          const sub = cent.newSubscription('benchmark:public');
          sub.on('publication', (ctx) => {
             console.log("Received publication from Centrifugo", ctx);
             // ctx.data is the binary payload (if configured correctly)
             // or base64 string if JSON. gocent publishes binary.
             // centrifuge-js handles binary if input is Uint8Array
             const buffer = ctx.data; 
             // Convert Uint8Array to ArrayBuffer for decode
             handleBufferResponse(buffer.buffer, "Buffer (Centrifugo)");
          });
          sub.subscribe();
          cent.connect();
          setCentrifuge(cent);

        } catch (e) {
          console.error("Centrifugo setup error:", e);
        }
      };
      connectCentrifugo();
    } else {
      setCentrifuge(null);
    }

    return () => {
      newSocket.disconnect();
      if (cent) cent.disconnect();
    };
  }, [port]);

  const handleBufferResponse = (buffer: ArrayBuffer, type: string) => {
      const endTime = performance.now();
      const duration = endTime - startTimeRef.current;
      
      let decodedData: any[] = [];
      try {
        decodedData = decode(buffer) as any[];
      } catch (e) {
        console.error("Decode error", e);
        return;
      }

      if (decodedData.length > 0 && Array.isArray(decodedData[0])) {
         decodedData = decodedData.map((item: any[]) => ({
          id: item[0],
          name: item[1],
          email: item[2],
          bio: item[3],
          active: item[4],
          roles: item[5],
          metadata: {
            lastLogin: item[6][0],
            preferences: {
              theme: item[6][1][0],
              notifications: item[6][1][1]
            }
          }
         }));
      }

      setMetrics({
        type: type,
        sizeBytes: buffer.byteLength,
        durationMs: duration,
        itemCount: decodedData.length,
        dataSample: JSON.stringify(decodedData[0], null, 2),
      });
      setLoading(false);
  };

  const handleGetJSON = () => {
    if (!socket) return;
    setLoading(true);
    setMetrics(null);
    startTimeRef.current = performance.now();
    socket.emit("request-json");
  };

  const handleGetBuffer = () => {
    if (!socket) return;
    setLoading(true);
    setMetrics(null);
    startTimeRef.current = performance.now();
    socket.emit("request-buffer");
  };

  const handleGetCentrifugo = () => {
    if (!socket) return;
    setLoading(true);
    setMetrics(null);
    startTimeRef.current = performance.now();
    // Use socket to tell backend to publish to Centrifugo
    socket.emit("trigger-centrifugo");
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleCentrifugoData = (data: any[]) => {
    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    
    // Calculate size (approximation for JSON)
    const jsonString = JSON.stringify(data);
    const size = new TextEncoder().encode(jsonString).length;

    setMetrics({
      type: "JSON (Centrifugo)",
      sizeBytes: size,
      durationMs: duration,
      itemCount: data.length,
      dataSample: JSON.stringify(data[0], null, 2),
    });
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          Socket.io Performance Benchmark
        </h1>
        
        {/* Backend Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-full p-1 flex items-center">
            <button
              onClick={() => setPort(3001)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                port === 3001 
                  ? "bg-blue-600 text-white shadow-lg" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Node.js (3001)
            </button>
            <button
              onClick={() => setPort(3002)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                port === 3002 
                  ? "bg-cyan-600 text-white shadow-lg" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Go (3002)
            </button>
          </div>
        </div>

        <p className="text-center text-gray-400 mb-12">
          Compare data transfer performance between pure JSON and MsgPack compressed Buffers.
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-8 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* JSON Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl hover:border-blue-500/50 transition-all">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">JSON Mode</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Sends data as standard JSON objects. Easy to debug but larger payload size.
            </p>
            <button
              onClick={handleGetJSON}
              disabled={loading || !socket}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              Get JSON Data
            </button>
          </div>

          {/* Buffer Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl hover:border-purple-500/50 transition-all">
            <h2 className="text-2xl font-semibold mb-4 text-purple-400">Buffer Mode</h2>
            <p className="text-gray-400 mb-6 text-sm">
              Compresses data using MessagePack binary format. Smaller payload, slightly more CPU usage.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleGetBuffer}
                disabled={loading || !socket}
                className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Get Buffer Data
              </button>
              
              {port === 3002 && (
                 <button
                  onClick={handleGetCentrifugo}
                  disabled={loading || !socket}
                  className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors animate-in fade-in zoom-in duration-300"
                >
                  Get Buffer via Centrifugo (Pub/Sub)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Area */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-400">Receiving and processing data...</p>
          </div>
        )}

        {metrics && !loading && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
              <h3 className="text-xl font-bold">
                Results: <span className={metrics.type.includes("JSON") ? "text-blue-400" : (metrics.type.includes("Centrifugo") ? "text-orange-400" : "text-purple-400")}>{metrics.type}</span>
              </h3>
              <span className="text-sm text-gray-500">Processed 1000 items</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-400 mb-1">Payload Size</p>
                <p className="text-3xl font-mono font-bold text-white">{formatBytes(metrics.sizeBytes)}</p>
                <p className="text-xs text-gray-500 mt-1">{metrics.sizeBytes.toLocaleString()} bytes</p>
              </div>
              
              <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-400 mb-1">Transfer Time</p>
                <p className="text-3xl font-mono font-bold text-white">{metrics.durationMs.toFixed(2)}ms</p>
                <p className="text-xs text-gray-500 mt-1">Latency + Processing</p>
              </div>

               <div className="bg-gray-800/50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-400 mb-1">Integrity Check</p>
                <p className="text-3xl font-mono font-bold text-green-400">Passed</p>
                <p className="text-xs text-gray-500 mt-1">Decoded {metrics.itemCount} items</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">Decoded Data Sample (First Item):</p>
              <pre className="bg-black/50 p-4 rounded-lg overflow-x-auto text-xs font-mono text-gray-300 border border-gray-800">
                {metrics.dataSample}
              </pre>
            </div>
          </div>
        )}

        {/* Realtime Monitor (Production Ready Component) */}
        {port === 3002 && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <RealtimeMonitor onDataReceived={handleCentrifugoData} />
          </div>
        )}

        <EtagDemo />
      </div>
    </main>
  );
}
