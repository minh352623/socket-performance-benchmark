"use client";

import { useEffect, useState } from 'react';
import { Centrifuge } from 'centrifuge';

interface Props {
  onDataReceived?: (data: any) => void;
}

export default function RealtimeMonitor({ onDataReceived }: Props) {
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Helper to fetch token (assuming Go backend is on 3002)
    const getToken = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/centrifugo-token');
        const json = await res.json();
        return json.token;
      } catch (e) {
        console.error("Failed to fetch token", e);
        return null;
      }
    };

    const initCentrifuge = async () => {
      const token = await getToken();
      if (!token) return;

      const cent = new Centrifuge('ws://localhost:8000/connection/websocket', {
        token: token,
      });

      cent.on('connected', (ctx) => {
          console.log("Connected:", ctx);
          setConnected(true);
      });
      cent.on('disconnected', () => setConnected(false));

      const sub = cent.newSubscription('benchmark:public:v3');
      
      sub.on('publication', (ctx) => {
        // ctx.data is standard JSON object now
        console.log("Received Data:", ctx.data);
        setData(ctx.data);
        if (onDataReceived) {
          onDataReceived(ctx.data);
        }
      });

      sub.subscribe();
      cent.connect();

      return () => cent.disconnect();
    };

    initCentrifuge();
  }, []);

  return (
    <div className="p-4 border rounded bg-gray-900 text-white font-mono mt-4">
      <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-lg text-orange-400">Centrifugo Realtime Monitor</h3>
          <span className={`px-2 py-1 rounded text-xs ${connected ? 'bg-green-600' : 'bg-red-600'}`}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
      </div>
      <p className="text-gray-400 text-sm mb-2">Channel: <b>benchmark:public:v3</b></p>
      
      <div className="bg-black p-4 rounded overflow-auto max-h-60 border border-gray-800">
        {data ? (
           <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
        ) : (
           <p className="text-gray-500 italic">Waiting for data...</p>
        )}
      </div>
    </div>
  );
}
