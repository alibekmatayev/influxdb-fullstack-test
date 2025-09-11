package main

import (
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

func NewInfluxClient(cfg *Config) influxdb2.Client {
	return influxdb2.NewClient(cfg.InfluxURL, cfg.Token)
}
