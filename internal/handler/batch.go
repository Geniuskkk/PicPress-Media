package handler

import (
	"archive/zip"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sync"

	"github.com/picpress/picpress/internal/processor"
)

// batchResult holds the outcome for a single file in a batch.
type batchResult struct {
	name string
	data []byte
	err  error
}

// Batch processes multiple images concurrently and returns a ZIP archive.
// Failed files are recorded in a `_errors.txt` entry inside the ZIP instead
// of being silently skipped.
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

	// Per-file size limit (same as single image endpoint)
	const maxFileSize = 50 << 20 // 50 MB

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
		MaxSizeKB:    clamp(intForm(r, "max_size_kb", 0), 0, 1024*1024),
	}

	// Process files concurrently with a worker pool to avoid OOM.
	const workers = 4
	results := make([]batchResult, len(files))
	var wg sync.WaitGroup
	sem := make(chan struct{}, workers)

	for i, fh := range files {
		wg.Add(1)
		go func(i int, fh *multipart.FileHeader) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			results[i] = processBatchFile(fh, params, maxFileSize)
		}(i, fh)
	}
	wg.Wait()

	// Stream ZIP to response; failed files are written into _errors.txt.
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="picpress_batch.zip"`)

	zw := zip.NewWriter(w)
	defer zw.Close()

	var failed []string
	usedNames := make(map[string]int)
	for _, res := range results {
		if res.err != nil {
			failed = append(failed, fmt.Sprintf("%s: %v", res.name, res.err))
			continue
		}

		name := uniqueZipName(res.name, usedNames)
		fw, err := zw.Create(name)
		if err != nil {
			// ZIP stream is already started; log the error and record it.
			failed = append(failed, fmt.Sprintf("%s: zip create error: %v", res.name, err))
			continue
		}
		if _, err := fw.Write(res.data); err != nil {
			failed = append(failed, fmt.Sprintf("%s: zip write error: %v", res.name, err))
		}
	}

	// Write error summary into the ZIP if any file failed.
	if len(failed) > 0 {
		ef, err := zw.Create("_errors.txt")
		if err == nil {
			for _, line := range failed {
				fmt.Fprintln(ef, line)
			}
		}
	}
}

func uniqueZipName(name string, used map[string]int) string {
	if used[name] == 0 {
		used[name] = 1
		return name
	}
	count := used[name]
	used[name]++
	for {
		base, ext := splitExt(name)
		candidate := fmt.Sprintf("%s_%d%s", base, count, ext)
		if used[candidate] == 0 {
			used[candidate] = 1
			return candidate
		}
		count++
	}
}

func splitExt(name string) (string, string) {
	for i := len(name) - 1; i > 0; i-- {
		if name[i] == '.' {
			return name[:i], name[i:]
		}
	}
	return name, ""
}

func processBatchFile(fh *multipart.FileHeader, params processor.Params, maxFileSize int64) batchResult {
	name := stripExt(fh.Filename) + "_picpress." + params.Format

	if fh.Size > maxFileSize {
		return batchResult{name: name, err: fmt.Errorf("file too large (max 50MB)")}
	}

	contentType := fh.Header.Get("Content-Type")
	if !isAllowedImage(contentType) {
		return batchResult{name: name, err: fmt.Errorf("unsupported image type")}
	}

	f, err := fh.Open()
	if err != nil {
		return batchResult{name: name, err: fmt.Errorf("open file: %w", err)}
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return batchResult{name: name, err: fmt.Errorf("read file: %w", err)}
	}
	if !isAllowedImage(http.DetectContentType(buf[:n])) {
		return batchResult{name: name, err: fmt.Errorf("file content does not match a supported image type")}
	}
	if seeker, ok := f.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return batchResult{name: name, err: fmt.Errorf("seek file: %w", err)}
		}
	}

	data, _, err := processor.Process(f, params)
	if err != nil {
		return batchResult{name: name, err: err}
	}

	return batchResult{name: name, data: data}
}

func stripExt(name string) string {
	for i := len(name) - 1; i > 0; i-- {
		if name[i] == '.' {
			return name[:i]
		}
	}
	return name
}
