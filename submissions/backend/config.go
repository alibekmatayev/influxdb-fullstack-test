package main

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	InfluxURL        string
	Org              string
	Bucket           string
	Measurement      string
	Token            string
	TimezoneLocation string
}

func LoadConfig() (*Config, error) {
	_ = godotenv.Load()
	cfg := &Config{
		InfluxURL:        os.Getenv("INFLUX_URL"),
		Org:              os.Getenv("INFLUX_ORG"),
		Bucket:           os.Getenv("INFLUX_BUCKET"),
		Measurement:      os.Getenv("INFLUX_MEASUREMENT"),
		Token:            os.Getenv("INFLUX_TOKEN"),
		TimezoneLocation: os.Getenv("TZ"),
	}
	return cfg, nil
}
