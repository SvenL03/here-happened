"use client";
/** STUB — the share/On-This-Day helper replaces this. Lists today's sourced events that have a place; onPick flies the map there. */
export interface TodayPanelProps {
  onPick: (p: { lat: number; lng: number; title: string }) => void;
  onClose: () => void;
}
export function TodayPanel(_props: TodayPanelProps) {
  return null;
}
