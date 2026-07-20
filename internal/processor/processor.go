package processor

import (
	"fmt"
	"io"

	"github.com/h2non/bimg"
)

// Params defines all processing options for an image.
type Params struct {
	// Crop region in the (already rotated/flipped) image coordinates (pixels).
	// The frontend bakes rotation/flip into the image before uploading when
	// an arbitrary angle is used, so these coordinates are always relative
	// to the visual canvas the user sees.
	// CropX/CropY == -1 means no crop.
	CropX int
	CropY int
	CropW int
	CropH int

	// Rotation in degrees. Only multiples of 90 are handled here; arbitrary
	// angles are expected to be baked into the image by the frontend before
	// upload (see Editor.vue bakeTransform).
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
//
// Pipeline order:
//  0. AutoRotate by EXIF (matches cropperjs preview behaviour)
//  1. Rotate (90° multiples only; arbitrary angles are pre-baked by frontend)
//  2. Flip horizontal / vertical
//  3. Crop
//  4. Resize
//  5. Format + quality conversion
func Process(r io.Reader, p Params) ([]byte, string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, "", fmt.Errorf("read file: %w", err)
	}

	img := bimg.NewImage(data)

	// 0. AutoRotate by EXIF so the backend coordinate space matches what the
	// user sees in cropperjs (which reads EXIF and rotates the preview).
	// This must happen before any manual rotate/flip/crop.
	data, err = img.AutoRotate()
	if err != nil {
		return nil, "", fmt.Errorf("auto rotate: %w", err)
	}
	img = bimg.NewImage(data)

	// 1. Rotate (90° multiples only)
	if p.Rotate != 0 {
		angle := bimg.Angle(((p.Rotate % 360) + 360) % 360)
		// libvips only supports 90/180/270; round to nearest valid angle.
		switch angle {
		case 90, 180, 270:
			data, err = img.Rotate(angle)
			if err != nil {
				return nil, "", fmt.Errorf("rotate: %w", err)
			}
			img = bimg.NewImage(data)
		default:
			// Non-90° angles should have been baked by the frontend.
			// If we still receive one, ignore it rather than corrupt output.
		}
	}

	// 2. Flip
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

	// 3. Crop
	if p.CropX >= 0 && p.CropW > 0 && p.CropH > 0 {
		opts := bimg.Options{
			Top:          p.CropY,
			Left:         p.CropX,
			AreaWidth:    p.CropW,
			AreaHeight:   p.CropH,
			NoAutoRotate: true,
		}
		data, err = img.Process(opts)
		if err != nil {
			return nil, "", fmt.Errorf("crop: %w", err)
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
