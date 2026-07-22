"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken } from "./api";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
const LIVE_EVENTS = [
  "task:available",
  "task:claimed",
  "task:removed",
  "task:updated",
  "task:submitted",
  "task:confirmed",
  "task:expired",
  "notification:new",
  "wallet:updated",
  "credits:updated",
  "payout:updated",
  "presence:updated"
] as const;

let socket: Socket | null = null;

export function getLiveSocket() {
  const token = getToken();
  if (!token) return null;
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
      auth: { token }
    });
  } else {
    socket.auth = { token };
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function useLiveRefresh(refresh: () => void | Promise<void>, events: readonly string[] = LIVE_EVENTS) {
  useEffect(() => {
    const live = getLiveSocket();
    if (!live) return;
    const handler = () => void refresh();
    events.forEach((event) => live.on(event, handler));
    live.on("connect", handler);
    live.on("reconnect", handler);
    return () => {
      events.forEach((event) => live.off(event, handler));
      live.off("connect", handler);
      live.off("reconnect", handler);
    };
  }, [events, refresh]);
}
