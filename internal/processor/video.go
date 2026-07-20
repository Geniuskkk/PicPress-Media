package processor

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type VideoParams struct {
	Format    string
	Quality   int
	MaxSizeMB int
}

// ffmpegBin returns the ffmpeg executable path.
// FFMPEG_PATH env var (set by Electron) takes priority over PATH.
func ffmpegBin() string {
	if p := os.Getenv("FFMPEG_PATH"); p != "" {
		return p
	}
	return "ffmpeg"
}

// ffprobeBin returns the ffprobe executable path.
// FFPROBE_PATH env var (set by Electron) takes priority over PATH.
func ffprobeBin() string {
	if p := os.Getenv("FFPROBE_PATH"); p != "" {
		return p
	}
	return "ffprobe"
}

// ProcessVideo transcodes a video with ffmpeg.
// The provided context controls cancellation: when the client disconnects or
// the request times out, the ffmpeg process is killed immediately.
func ProcessVideo(ctx context.Context, r io.Reader, filename string, p VideoParams) ([]byte, string, error) {
	ffmpeg := ffmpegBin()
	ffprobe := ffprobeBin()

	if _, err := exec.LookPath(ffmpeg); err != nil {
		return nil, "", fmt.Errorf("ffmpeg not found: %s", ffmpeg)
	}
	if _, err := exec.LookPath(ffprobe); err != nil {
		return nil, "", fmt.Errorf("ffprobe not found: %s", ffprobe)
	}

	tempDir, err := os.MkdirTemp("", "picpress-video-*")
	if err != nil {
		return nil, "", fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	inputExt := strings.ToLower(filepath.Ext(filename))
	if inputExt == "" {
		inputExt = ".mp4"
	}
	inputPath := filepath.Join(tempDir, "input"+inputExt)
	outputPath := filepath.Join(tempDir, "output."+normalizeVideoFormat(p.Format))

	inputFile, err := os.Create(inputPath)
	if err != nil {
		return nil, "", fmt.Errorf("create temp input: %w", err)
	}
	if _, err := io.Copy(inputFile, r); err != nil {
		inputFile.Close()
		return nil, "", fmt.Errorf("write temp input: %w", err)
	}
	if err := inputFile.Close(); err != nil {
		return nil, "", fmt.Errorf("close temp input: %w", err)
	}

	args, err := buildVideoCommandArgs(inputPath, outputPath, p)
	if err != nil {
		return nil, "", err
	}

	// Hard timeout: kill ffmpeg after 30 minutes regardless of progress.
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, ffmpegBin(), args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, "", fmt.Errorf("ffmpeg timed out after 30 minutes")
		}
		if ctx.Err() == context.Canceled {
			return nil, "", fmt.Errorf("video processing cancelled")
		}
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return nil, "", fmt.Errorf("ffmpeg failed: %s", message)
	}

	data, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, "", fmt.Errorf("read output: %w", err)
	}

	return data, videoFormatToMIME(normalizeVideoFormat(p.Format)), nil
}

func buildVideoCommandArgs(inputPath, outputPath string, p VideoParams) ([]string, error) {
	format := normalizeVideoFormat(p.Format)
	quality := clampVideoQuality(p.Quality)
	audioBitrateK := 96

	args := []string{"-y", "-i", inputPath, "-map_metadata", "-1"}
	args = append(args, videoCodecArgs(format)...)

	if p.MaxSizeMB > 0 {
		duration, err := probeVideoDuration(inputPath)
		if err != nil {
			return nil, fmt.Errorf("probe duration: %w", err)
		}
		totalBitrateK := int((float64(p.MaxSizeMB) * 8192) / duration)
		if totalBitrateK < audioBitrateK+300 {
			totalBitrateK = audioBitrateK + 300
		}
		videoBitrateK := totalBitrateK - audioBitrateK
		args = append(args, "-b:v", fmt.Sprintf("%dk", videoBitrateK))
		if format == "mp4" {
			args = append(args, "-maxrate", fmt.Sprintf("%dk", videoBitrateK), "-bufsize", fmt.Sprintf("%dk", videoBitrateK*2))
		}
	} else {
		args = append(args, "-crf", strconv.Itoa(videoQualityToCRF(quality)))
	}

	args = append(args, videoAudioArgs(format, audioBitrateK)...)
	if format == "mp4" {
		args = append(args, "-movflags", "+faststart", "-pix_fmt", "yuv420p")
	}
	args = append(args, outputPath)
	return args, nil
}

func probeVideoDuration(inputPath string) (float64, error) {
	output, err := exec.Command(
		ffprobeBin(),
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		inputPath,
	).CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %s", strings.TrimSpace(string(output)))
	}

	duration, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil || duration <= 0 {
		return 0, fmt.Errorf("invalid duration")
	}
	return duration, nil
}

func videoCodecArgs(format string) []string {
	if format == "webm" {
		return []string{"-c:v", "libvpx-vp9", "-deadline", "good", "-cpu-used", "2", "-row-mt", "1"}
	}
	return []string{"-c:v", "libx264", "-preset", "medium"}
}

func videoAudioArgs(format string, bitrateK int) []string {
	if format == "webm" {
		return []string{"-c:a", "libopus", "-b:a", fmt.Sprintf("%dk", bitrateK)}
	}
	return []string{"-c:a", "aac", "-b:a", fmt.Sprintf("%dk", bitrateK)}
}

func videoQualityToCRF(quality int) int {
	return 40 - ((quality - 1) * 22 / 99)
}

func clampVideoQuality(quality int) int {
	if quality < 1 {
		return 72
	}
	if quality > 100 {
		return 100
	}
	return quality
}

func normalizeVideoFormat(format string) string {
	if strings.ToLower(format) == "webm" {
		return "webm"
	}
	return "mp4"
}

func videoFormatToMIME(format string) string {
	if format == "webm" {
		return "video/webm"
	}
	return "video/mp4"
}
