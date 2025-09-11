"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.scss";
import { getIMEIs, getTelemetry, getFields, TelemetryResponse } from "@/lib/api";
import LineChart from "@/components/LineChart";
import MapView from "@/components/MapView";


function toISOZ(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

type FieldConfig = {
  key: string;
  label: string;
  color: string;
  yLabel: string;
  enabled: boolean;
};

const FIELD_CONFIGS: FieldConfig[] = [
  { key: "speed", label: "Скорость", color: "#4c8cff", yLabel: "км/ч", enabled: true },
  { key: "fls485_level_1", label: "Уровень топлива 1", color: "#ff6b6b", yLabel: "ед.", enabled: false },
  { key: "fls485_level_2", label: "Уровень топлива 2", color: "#b56cff", yLabel: "ед.", enabled: true },
  { key: "main_power_voltage", label: "Бортсеть", color: "#1ca67a", yLabel: "В", enabled: true },
  { key: "map", label: "Карта перемещений", color: "#ffa500", yLabel: "", enabled: true },
];

const PERIOD_OPTIONS = [
  { key: "today", label: "Сегодня", hours: 24 },
  { key: "yesterday", label: "Вчера", hours: 24 },
  { key: "week", label: "За неделю", hours: 168 },
  { key: "month", label: "За месяц", hours: 720 },
];

export default function TelemetryPage() {
  const [imeis, setImeis] = useState<string[]>([]);
  const [imei, setImei] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [currentField, setCurrentField] = useState<string>("speed");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");

  useEffect(() => {
    getIMEIs()
      .then((r) => {
        setImeis(r.imeis || []);
        if (r.imeis?.[0]) setImei(r.imeis[0]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const now = new Date();
    const endDefault = new Date(now);
    const startDefault = new Date(now);
    startDefault.setDate(now.getDate() - 1);
    const toLocalInput = (d: Date) => {
      const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return z.toISOString().slice(0, 16);
    };
    setStart(toLocalInput(startDefault));
    setEnd(toLocalInput(endDefault));
  }, []);

  useEffect(() => {
    if (imei) {
      setFieldsLoading(true);
      setAvailableFields([]);
      getFields(imei)
        .then((r) => {
          setAvailableFields(r.fields || []);
        })
        .catch((e) => {
          console.error("Ошибка загрузки полей:", e);
          setError("Ошибка загрузки доступных параметров");
        })
        .finally(() => {
          setFieldsLoading(false);
        });
    }
  }, [imei]);

  useEffect(() => {
    if (imei && !fieldsLoading && availableFields.length > 0 && start && end) {
      const autoLoadData = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        try {
          const res = await getTelemetry({
            imei,
            start: toISOZ(start),
            end: toISOZ(end),
          });
          setData(res);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      };

      autoLoadData();
    }
  }, [imei, fieldsLoading, availableFields.length, start, end]);

  const setPeriod = (periodKey: string) => {
    setSelectedPeriod(periodKey);
    const now = new Date();
    const endTime = new Date(now);
    const startTime = new Date(now);

    switch (periodKey) {
      case "today":
        startTime.setHours(0, 0, 0, 0);
        endTime.setHours(23, 59, 59, 999);
        break;
      case "yesterday":
        startTime.setDate(now.getDate() - 1);
        startTime.setHours(0, 0, 0, 0);
        endTime.setDate(now.getDate() - 1);
        endTime.setHours(23, 59, 59, 999);
        break;
      case "week":
        startTime.setDate(now.getDate() - 7);
        break;
      case "month":
        startTime.setMonth(now.getMonth() - 1);
        break;
    }

    const toLocalInput = (d: Date) => {
      const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return z.toISOString().slice(0, 16);
    };

    setStart(toLocalInput(startTime));
    setEnd(toLocalInput(endTime));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await getTelemetry({
        imei,
        start: toISOZ(start),
        end: toISOZ(end),
      });
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const trackCount = (data?.track || []).length;

  const hasFieldData = (fieldKey: string) => {
    if (!data) return false;
    
    if (fieldKey === "map") {
      return trackCount > 0;
    }
    
    const fieldData = data.series[fieldKey as keyof typeof data.series];
    return fieldData && fieldData.length > 0;
  };

  const isFieldAvailable = (fieldKey: string) => {
    if (fieldKey === "map") {
      return data ? hasFieldData(fieldKey) : false;
    }

    const existsInDB = availableFields.includes(fieldKey);

    if (!data) {
      return existsInDB;
    }

    return existsInDB && hasFieldData(fieldKey);
  };

  const getCurrentFieldData = () => {
    if (!data) return [];
    if (currentField === "map") return [];
    return data.series[currentField as keyof typeof data.series] || [];
  };

  const getCurrentFieldConfig = () => {
    return FIELD_CONFIGS.find(f => f.key === currentField) || FIELD_CONFIGS[0];
  };

  const renderLoadingOverlay = () => {
    if (!loading) return null;
    
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.loadingTextLarge}>Загрузка данных...</div>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    if (!data) {
      return (
        <div className="panel">
          <div className={styles.noData}>
            {loading ? "" : "Выберите параметры и загрузите данные"}
          </div>
        </div>
      );
    }

    if (currentField === "map") {
      if (trackCount === 0) {
        return (
          <div className="panel">
            <div className={styles.noData}>
              Нет данных трека для отображения карты
            </div>
          </div>
        );
      }
      return (
        <div className={`panel ${styles.chartContainer}`}>
          <h3>Карта перемещений</h3>
          <MapView track={data.track || []} width="100%" height={340} />
        </div>
      );
    }

    const fieldData = getCurrentFieldData();
    if (fieldData.length === 0) {
      return (
        <div className="panel">
          <div className={styles.noData}>
            Нет данных для поля &quot;{getCurrentFieldConfig().label}&quot;
          </div>
        </div>
      );
    }

    return (
      <div className={`panel ${styles.chartContainer}`}>
        <LineChart
          title={getCurrentFieldConfig().label}
          yLabel={getCurrentFieldConfig().yLabel}
          data={fieldData}
          color={getCurrentFieldConfig().color}
          height={200}
        />
      </div>
    );
  };

  return (
    <div className={styles.container}>

      <div className={`${styles.header} panel`}>
        <div className={styles.headerTop}>
          <h2>Телеметрия</h2>
          <div className={styles.badges}>
            {imei && <span className="tag">IMEI: {imei}</span>}
            {trackCount > 0 && <span className="tag">{trackCount} точек</span>}
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>Ошибка: {error}</div>}


      <div className={styles.mainContent}>
        {renderLoadingOverlay()}
        <div className={styles.chartArea}>
          {renderCurrentView()}
        </div>
      </div>


      <div className={styles.bottomFilters}>
        <div className={`${styles.filtersPanel} panel`}>
          <div className={styles.filtersGrid}>

            <div className={styles.filterSection}>
              <h4>IMEI</h4>
              <select 
                className="select" 
                value={imei} 
                onChange={(e) => setImei(e.target.value)}
                disabled={fieldsLoading}
              >
                {imeis.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {/* {renderAvailableFieldsInfo()} */}
            </div>

            <div className={styles.filterSection}>
              <h4>Период</h4>
              <div className={styles.periodButtons}>
                {PERIOD_OPTIONS.map((period) => (
                  <button
                    key={period.key}
                    className={`${styles.periodBtn} ${selectedPeriod === period.key ? styles.active : ''}`}
                    onClick={() => setPeriod(period.key)}
                    disabled={loading}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterSection}>
              <h4>Отображение</h4>
              <select 
                className="select" 
                value={currentField} 
                onChange={(e) => setCurrentField(e.target.value)}
                disabled={fieldsLoading || loading}
              >
                {FIELD_CONFIGS.map((field) => {
                  const isAvailable = isFieldAvailable(field.key);
                  return (
                    <option 
                      key={field.key} 
                      value={field.key}
                      disabled={!isAvailable}
                    >
                      {field.label}{!isAvailable ? " (недоступно)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className={styles.filterSection}>
              <button 
                className="btn"
                onClick={submit}
                disabled={loading || !imei || fieldsLoading}
              >
                {loading ? "Загрузка..." : "Загрузить"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}