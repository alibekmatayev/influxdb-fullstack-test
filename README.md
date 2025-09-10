# Цель
Локальное веб-приложение, которое подключается к InfluxDB, выбирает данные по IMEI за период и рисует графики + трек на карте.

## _Доступ к БД:_
- **InfluxDB 2.x URL:** ```sh http://185.234.114.212:8086/```
- **org:** ```sh Kontrol Techniki```
- **bucket:** ```sh t```
- **measurement:** ```sh telemetry```
- **token:** ***```выдают отдельно. Не коммитить!```***

## _Создать .env из примера:_

```
# .env.example
INFLUX_URL=http://185.234.114.212:8086/
INFLUX_ORG=Kontrol Techniki
INFLUX_BUCKET=t
INFLUX_MEASUREMENT=telemetry
INFLUX_TOKEN=__PUT_YOUR_TOKEN_HERE__
TZ=Asia/Almaty
```

***Токен просить у работодателя. В git не выкладывать!***

## _Что сделать_

**Бэкенд (сугубо на Ваш выбор).**

- Подключение к InfluxDB через ```influxdb-client.```

**Эндпоинты:**
- GET /api/imeis → список доступных IMEI.
- GET /api/fields?imei=... → список доступных _field для данного IMEI.
- GET /api/telemetry?imei=...&start=...&end=... → данные за период:
    - **event_time** (timestamp, если в БД хранится как поле - вернуть как UNIX-секунды; если нет - вернуть _time и продублировать как event_time).
    - **speed** (int).
    - **fls485_level_2** (int).
    - **latitude** (double).
    - **longitude** (double).
    - **main_power_voltage** (int в БД, отдать в Вольтах: мВ/1000, округлить до 0.01 В).

**Формат ответа JSON:**
```sh 
{
  "series": {
    "speed": [{"time":"2025-09-10T08:20:00Z","value":42}, ...],
    "fls485_level_2": [{"time":"2025-09-10T08:20:00Z","value":120}, ...],
    "main_power_voltage": [{"time":"2025-09-10T08:20:00Z","value":24.56}, ...]
  },
  "track": [
    {"time":"2025-09-10T08:20:00Z","lat":51.23,"lon":71.42,"event_time":1694334000},
    ...
  ]
}
```
Временной формат входных параметров: ISO-8601 (YYYY-MM-DDTHH:MM:SSZ) или с таймзоной +05:00. В ответе - ISO-8601 в UTC.

**Фронтенд.**
- Поля ввода: селектор IMEI, выбор дат-времени от/до (календарь + время).
- Графики: speed, fls485_level_2, main_power_voltage (в Вольтах).
- Карта: полилиния трека за период по latitude/longitude.
- Любые библиотеки: 
    - графики (Recharts/Chart.js),
    - карта (Leaflet/Mapbox GL).
- Локальное время в UI - Asia/Almaty. На API слать ISO строку.

**Запуск локально.**
- Либо docker-compose (frontend + backend).
- Либо два процесса (npm start / uvicorn main:app --reload).
- Либо расписать процесс запуска Вашего проекта отдельно.

**README с командами запуска обязателен.**

## _Flux-шпаргалка_

#### _Список IMEI_
```py
from(bucket: "t")
  |> range(start: -30d)
  |> filter(fn: (r) => r["_measurement"] == "telemetry")
  |> keep(columns: ["imei"])
  |> group()
  |> distinct(column: "imei")
  |> sort(columns: ["imei"])
```

#### _Список _field для IMEI:__
```py
imei = "866795038154462"
from(bucket: "t")
  |> range(start: -30d)
  |> filter(fn: (r) => r["_measurement"] == "telemetry")
  |> filter(fn: (r) => r["imei"] == imei)
  |> keep(columns: ["_field"])
  |> group()
  |> distinct(column: "_field")
  |> sort(columns: ["_field"])
```

#### _Данные за период для нужных полей (пример - одним запросом, с поворотом в колонки):_
```py
imei = "866795038154462"
start = time(v: "2025-09-10T00:00:00Z")
stop  = time(v: "2025-09-11T00:00:00Z")

from(bucket: "t")
  |> range(start: start, stop: stop)
  |> filter(fn: (r) => r["_measurement"] == "telemetry" and r["imei"] == imei)
  |> filter(fn: (r) => r["_field"] == "speed" or r["_field"] == "fls485_level_2" or r["_field"] == "latitude" or r["_field"] == "longitude" or r["_field"] == "main_power_voltage" or r["_field"] == "event_time")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
  |> map(fn: (r) => ({
      r with
      main_power_voltage: if exists r.main_power_voltage then float(v: r.main_power_voltage) / 1000.0 else  float(v: 0.0)
  }))
```

## _Примечания:_

 - Если точек много, допускается даунсэмплинг:
```|> aggregateWindow(every: 1m, fn: mean, createEmpty: false)```
- Если ```event_time``` хранится строкой - приведите ```int(v: r["event_time"])```* на бэкенде и верните как UNIX-секунды.
- Если координаты приходят разреженно, фильтруйте пары без ```lat/lon```.

## _Требования к UI_
- Выбор IMEI, выбор диапазона дат-времени.
- Три графика: ```speed```, ```fls485_level_2```, ```main_power_voltage (В)```.
- Карта с треком за период.
- Легенды, подписи осей, единицы измерения.
- Обработка пустых выборок и ошибок.

## _Нефункциональные требования_
- Код читаемый. Конфиг через ```.env```.
- Без хардкода токенов.
- Ответ API ≤ 10 тыс. точек на ряд. Больше - агрегируйте.
- Таймзона UI - Asia/Almaty. На сервере хранить/отдавать UTC.

## _Как проверять_
- Скопировать ```.env.example``` в ```.env```, вписать ```токен```.
- Запустить бэкенд и фронтенд.
- Открыть UI, выбрать IMEI, задать например 10.09.2025 00:00 → 11.09.2025 00:00 (UTC или локально в +05:00).
- Увидеть три графика и трек. Напряжение в В, не в мВ.

## _Что сдавать_
- Сделать fork репозитория.
- Создать папку `submissions/ИМЯ_КАНДИДАТА/` и положить туда код.
- Сделать Pull Request (PR) обратно в этот репозиторий.
- Краткая записка по решениям и компромиссам (агрегация, обработка дыр, валидации).

## _Критерии оценки_
- Корректные Flux-запросы.
- Корректные преобразования единиц и времени.
- Оптимизация больших данных без потери корректности.
- Стабильность и обработка краевых случаев.
- Чистота кода и структура проекта.
- UX без лишнего шума.
