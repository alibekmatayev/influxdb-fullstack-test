package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	influxdb2api "github.com/influxdata/influxdb-client-go/v2/api"
)

func GetIMEIsHandler(c *gin.Context, queryAPI influxdb2api.QueryAPI, bucket string) {
	flux := `from(bucket: "` + bucket + `")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "telemetry")
      |> keep(columns: ["imei"])
      |> group()
      |> distinct(column: "imei")
      |> sort(columns: ["imei"])`
	result, err := queryAPI.Query(context.Background(), flux)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var imeis []string
	for result.Next() {
		if s, ok := result.Record().Value().(string); ok {
			imeis = append(imeis, s)
		}
	}
	c.JSON(http.StatusOK, gin.H{"imeis": imeis})
}

func GetFieldsHandler(c *gin.Context, queryAPI influxdb2api.QueryAPI, bucket string) {
	imei := c.Query("imei")
	if imei == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imei required"})
		return
	}
	flux := `from(bucket: "` + bucket + `")
      |> range(start: -30d)
      |> filter(fn: (r) => r["_measurement"] == "telemetry")
      |> filter(fn: (r) => r["imei"] == "` + imei + `")
      |> keep(columns: ["_field"])
      |> group()
      |> distinct(column: "_field")
      |> sort(columns: ["_field"])`
	result, err := queryAPI.Query(context.Background(), flux)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var fields []string
	for result.Next() {
		if s, ok := result.Record().Value().(string); ok {
			fields = append(fields, s)
		}
	}
	c.JSON(http.StatusOK, gin.H{"fields": fields})
}
func GetTelemetryHandler(c *gin.Context, queryAPI influxdb2api.QueryAPI, bucket string) {
	imei := c.Query("imei")
	start := c.Query("start")
	end := c.Query("end")
	if imei == "" || start == "" || end == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imei, start and end parameters are required"})
		return
	}

	flux := `from(bucket: "` + bucket + `")
      |> range(start: time(v: "` + start + `"), stop: time(v: "` + end + `"))
      |> filter(fn: (r) => r["_measurement"] == "telemetry" and r["imei"] == "` + imei + `")
      |> filter(fn: (r) => r["_field"] == "speed" or r["_field"] == "fls485_level_1" or r["_field"] == "fls485_level_2" or r["_field"] == "latitude" or r["_field"] == "longitude" or r["_field"] == "main_power_voltage" or r["_field"] == "event_time")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])
      |> map(fn: (r) => ({
          r with main_power_voltage: if exists r.main_power_voltage then float(v: r.main_power_voltage) / 1000.0 else float(v: 0.0)
      }))
      |> limit(n:10000)`

	result, err := queryAPI.Query(context.Background(), flux)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type SeriesPoint struct {
		Time  string  `json:"time"`
		Value float64 `json:"value"`
	}
	type TrackPoint struct {
		Time      string  `json:"time"`
		Lat       float64 `json:"lat"`
		Lon       float64 `json:"lon"`
		EventTime int64   `json:"event_time"`
	}

	var speed, fls485_level_1, fls485_level_2, main_power_voltage []SeriesPoint
	var track []TrackPoint

	for result.Next() {
		record := result.Record()
		values := record.Values()
		_time := record.Time().UTC().Format(time.RFC3339)

		// speed
		if v, ok := toFloat64(values["speed"]); ok {
			speed = append(speed, SeriesPoint{Time: _time, Value: v})
		}
		if v, ok := toFloat64(values["fls485_level_1"]); ok {
			fls485_level_1 = append(fls485_level_1, SeriesPoint{Time: _time, Value: v})
		}
		if v, ok := toFloat64(values["fls485_level_2"]); ok {
			fls485_level_2 = append(fls485_level_2, SeriesPoint{Time: _time, Value: v})
		}
		if v, ok := toFloat64(values["main_power_voltage"]); ok {
			main_power_voltage = append(main_power_voltage, SeriesPoint{Time: _time, Value: v})
		}

		lat, latOk := toFloat64(values["latitude"])
		lon, lonOk := toFloat64(values["longitude"])
		if latOk && lonOk {
			eventTime := getEventTime(values, record.Time())
			track = append(track, TrackPoint{
				Time:      _time,
				Lat:       lat,
				Lon:       lon,
				EventTime: eventTime,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"series": gin.H{
			"speed":              speed,
			"fls485_level_1":     fls485_level_1,
			"fls485_level_2":     fls485_level_2,
			"main_power_voltage": main_power_voltage,
		},
		"track": track,
	})
}

func toFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case int64:
		return float64(v), true
	case int32:
		return float64(v), true
	case int:
		return float64(v), true
	default:
		return 0, false
	}
}

func getEventTime(values map[string]interface{}, recordTime time.Time) int64 {
	if ev, ok := values["event_time"]; ok {
		switch v := ev.(type) {
		case int64:
			return v
		case string:
			t, err := time.Parse(time.RFC3339, v)
			if err == nil {
				return t.Unix()
			}
		}
	}
	return recordTime.Unix()
}
