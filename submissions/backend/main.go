package main

import (
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}

	influxClient := NewInfluxClient(cfg)
	defer influxClient.Close()
	queryAPI := influxClient.QueryAPI(cfg.Org)

	router := gin.Default()

	// Роуты
	router.GET("/api/imeis", func(c *gin.Context) {
		GetIMEIsHandler(c, queryAPI, cfg.Bucket)
	})
	router.GET("/api/fields", func(c *gin.Context) {
		GetFieldsHandler(c, queryAPI, cfg.Bucket)
	})
	router.GET("/api/telemetry", func(c *gin.Context) {
		GetTelemetryHandler(c, queryAPI, cfg.Bucket)
	})

	router.Run(":8080")
}
