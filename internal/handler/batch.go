package handler

import (
	"archive/zip"
	"fmt"
	"net/http"

	"github.com/picpress/picpress/internal/processor"
)

func Batch(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 500<<20) // 500 MB total
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		http.Error(w, "request too large", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		http.Error(w, "no files provided", http.StatusBadRequest)
		return
	}
	if len(files) > 100 {
		http.Error(w, "too many files (max 100)", http.StatusBadRequest)
		return
	}

	params := processor.Params{
		Format:    sanitizeFormat(r.FormValue("format")),
		Quality:   clamp(intForm(r, "quality", 85), 1, 100),
		MaxSizeKB: intForm(r, "max_size_kb", 0),
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="picpress_batch.zip"`)

	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, fh := range files {
		contentType := fh.Header.Get("Content-Type")
		if !isAllowedImage(contentType) {
			continue
		}

		f, err := fh.Open()
		if err != nil {
			continue
		}

		result, _, err := processor.Process(f, params)
		f.Close()
		if err != nil {
			continue
		}

		name := stripExt(fh.Filename) + "_picpress." + params.Format
		fw, err := zw.Create(name)
		if err != nil {
			http.Error(w, fmt.Sprintf("zip error: %v", err), http.StatusInternalServerError)
			return
		}
		fw.Write(result)
	}
}

func stripExt(name string) string {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			return name[:i]
		}
	}
	return name
}
