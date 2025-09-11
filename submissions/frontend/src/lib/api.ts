
export type SeriesPoint = { time: string; value: number };
export type TrackPoint = { time: string; lat: number; lon: number; event_time: number };

export type TelemetryResponse = {
  series: {
    speed?: SeriesPoint[];
    fls485_level_1?: SeriesPoint[];
    fls485_level_2?: SeriesPoint[];
    main_power_voltage?: SeriesPoint[];
  };
  track: TrackPoint[];
};

async function http<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const getIMEIs = () => http<{ imeis: string[] }>("/api/imeis");

export const getFields = (imei: string) =>
  http<{ fields: string[] }>(`/api/fields?imei=${encodeURIComponent(imei)}`);

export const getTelemetry = (params: { imei: string; start: string; end: string }) => {
  const q = new URLSearchParams({
    imei: params.imei,
    start: params.start,
    end: params.end,
  });
  return http<TelemetryResponse>(`/api/telemetry?${q.toString()}`);
};