package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/picpress/picpress/internal/processor"
)

const maxUploadSize = 50 << 20 // 50 MB

func Process(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "file too large (max 50MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate MIME type
	contentType := header.Header.Get("Content-Type")
	if !isAllowedImage(contentType) {
		http.Error(w, "unsupported image type", http.StatusBadRequest)
		return
	}

	params := processor.Params{
		CropX:        intForm(r, "crop_x", -1),
		CropY:        intForm(r, "crop_y", -1),
		CropW:        intForm(r, "crop_w", 0),
		CropH:        intForm(r, "crop_h", 0),
		Rotate:       intForm(r, "rotate", 0),
		FlipH:        r.FormValue("flip_h") == "1",
		FlipV:        r.FormValue("flip_v") == "1",
		OutputWidth:  intForm(r, "output_width", 0),
		OutputHeight: intForm(r, "output_height", 0),
		Format:       sanitizeFormat(r.FormValue("format")),
		Quality:      clamp(intForm(r, "quality", 85), 1, 100),
		MaxSizeKB:    intForm(r, "max_size_kb", 0),
	}

	result, mimeType, err := processor.Process(file, params)
	if err != nil {
		http.Error(w, fmt.Sprintf("processing failed: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.Itoa(len(result)))
	w.Header().Set("Content-Disposition", "attachment")
	w.WriteHeader(http.StatusOK)
	w.Write(result)
}

func isAllowedImage(mime string) bool {
	allowed := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
		"image/heic": true,
		"image/heif": true,
		"image/avif": true,
		"image/tiff": true,
	}
	return allowed[mime]
}

func sanitizeFormat(f string) string {
	allowed := map[string]bool{"jpg": true, "jpeg": true, "png": true, "webp": true, "avif": true}
	if allowed[f] {
		return f
	}
	return "jpg"
}

func intForm(r *http.Request, key string, def int) int {
	v := r.FormValue(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
