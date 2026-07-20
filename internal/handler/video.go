package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/picpress/picpress/internal/processor"
)

const maxVideoUploadSize = 1 << 30 // 1 GB

func VideoProcess(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxVideoUploadSize)
	if err := r.ParseMultipartForm(maxVideoUploadSize); err != nil {
		http.Error(w, "video too large (max 1GB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !isAllowedVideo(contentType, header.Filename) {
		http.Error(w, "unsupported video type", http.StatusBadRequest)
		return
	}

	params := processor.VideoParams{
		Format:    sanitizeVideoFormat(r.FormValue("format")),
		Quality:   clamp(intForm(r, "quality", 72), 1, 100),
		MaxSizeMB: intForm(r, "max_size_mb", 0),
	}

	result, mimeType, err := processor.ProcessVideo(r.Context(), file, header.Filename, params)
	if err != nil {
		http.Error(w, fmt.Sprintf("video processing failed: %v", err), http.StatusInternalServerError)
		return
	}

	name := stripExt(header.Filename) + "_picpress." + params.Format
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.Itoa(len(result)))
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
	w.WriteHeader(http.StatusOK)
	w.Write(result)
}

func isAllowedVideo(mime, filename string) bool {
	allowedMIMEs := map[string]bool{
		"video/mp4":                true,
		"video/quicktime":          true,
		"video/webm":               true,
		"video/x-matroska":         true,
		"video/x-msvideo":          true,
		"video/x-ms-wmv":           true,
		"application/octet-stream": true,
	}
	if allowedMIMEs[mime] {
		return true
	}

	allowedExt := map[string]bool{
		".mp4":  true,
		".mov":  true,
		".m4v":  true,
		".webm": true,
		".mkv":  true,
		".avi":  true,
		".wmv":  true,
	}
	return allowedExt[strings.ToLower(filepath.Ext(filename))]
}

func sanitizeVideoFormat(format string) string {
	switch strings.ToLower(format) {
	case "webm":
		return "webm"
	default:
		return "mp4"
	}
}
