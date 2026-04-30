package processor

import (
	"fmt"
	"io"

	"github.com/h2non/bimg"
)

// Params defines all processing options for an image.
type Params struct {
	// Crop region in original image coordinates (pixels).
	// CropX/CropY == -1 means no crop.
	CropX int
	CropY int
	CropW int
	CropH int

	// Rotation in degrees (0, 90, 180, 270)
	Rotate int

	// Flip
	FlipH bool
	FlipV bool

	// Resize output (0 = keep cropped size)
	OutputWidth  int
	OutputHeight int

	// Output format: jpg, png, webp, avif
	Format string

	// Quality 1-100 (JPEG/WebP/AVIF)
	Quality int

	// Target max file size in KB (0 = disabled).
	// We iterate quality down until size fits.
	MaxSizeKB int
}

// Process takes a reader (image file), applies all params, and returns the result bytes.
func Process(r io.Reader, p Params) ([]byte, string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, "", fmt.Errorf("read file: %w", err)
	}

	img := bimg.NewImage(data)

	// 1. Crop
	if p.CropX >= 0 && p.CropW > 0 && p.CropH > 0 {
		opts := bimg.Options{
			Top:    p.CropY,
			Left:   p.CropX,
			AreaWidth:  p.CropW,
			AreaHeight: p.CropH,
			NoAutoRotate: true,
		}
		data, err = img.Process(opts)
		if err != nil {
			return nil, "", fmt.Errorf("crop: %w", err)
		}
		img = bimg.NewImage(data)
	}

	// 2. Rotate
	if p.Rotate != 0 {
		angle := bimg.Angle(((p.Rotate % 360) + 360) % 360)
		data, err = img.Rotate(angle)
		if err != nil {
			return nil, "", fmt.Errorf("rotate: %w", err)
		}
		img = bimg.NewImage(data)
	}

	// 3. Flip
	if p.FlipH {
		data, err = img.Flop()
		if err != nil {
			return nil, "", fmt.Errorf("flop: %w", err)
		}
		img = bimg.NewImage(data)
	}
	if p.FlipV {
		data, err = img.Flip()
		if err != nil {
			return nil, "", fmt.Errorf("flip: %w", err)
		}
		img = bimg.NewImage(data)
	}

	// 4. Resize
	if p.OutputWidth > 0 || p.OutputHeight > 0 {
		opts := bimg.Options{
			Width:  p.OutputWidth,
			Height: p.OutputHeight,
			Force:  p.OutputWidth > 0 && p.OutputHeight > 0,
		}
		data, err = img.Process(opts)
		if err != nil {
			return nil, "", fmt.Errorf("resize: %w", err)
		}
		img = bimg.NewImage(data)
	}

	// 5. Format + Quality conversion
	imageType := formatToType(p.Format)
	quality := p.Quality
	if quality == 0 {
		quality = 85
	}

	result, err := img.Process(bimg.Options{
		Type:    imageType,
		Quality: quality,
	})
	if err != nil {
		return nil, "", fmt.Errorf("convert: %w", err)
	}

	// 6. Iterate quality down to hit MaxSizeKB target
	if p.MaxSizeKB > 0 {
		targetBytes := p.MaxSizeKB * 1024
		for quality > 10 && len(result) > targetBytes {
			quality -= 5
			result, err = bimg.NewImage(data).Process(bimg.Options{
				Type:    imageType,
				Quality: quality,
			})
			if err != nil {
				break
			}
		}
	}

	mimeType := typeToMIME(imageType)
	return result, mimeType, nil
}

func formatToType(format string) bimg.ImageType {
	switch format {
	case "png":
		return bimg.PNG
	case "webp":
		return bimg.WEBP
	case "avif":
		return bimg.AVIF
	default:
		return bimg.JPEG
	}
}

func typeToMIME(t bimg.ImageType) string {
	switch t {
	case bimg.PNG:
		return "image/png"
	case bimg.WEBP:
		return "image/webp"
	case bimg.AVIF:
		return "image/avif"
	default:
		return "image/jpeg"
	}
}
