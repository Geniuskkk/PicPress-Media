package handler

import (
	"encoding/json"
	"net/http"
	"runtime/debug"
)

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func Health(w http.ResponseWriter, r *http.Request) {
	version := "dev"
	if info, ok := debug.ReadBuildInfo(); ok {
		version = info.Main.Version
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(healthResponse{Status: "ok", Version: version})
}
