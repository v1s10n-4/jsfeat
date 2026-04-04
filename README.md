# jsfeat

Modern TypeScript port of the [jsfeat](https://github.com/inspirit/jsfeat) Computer Vision library.

## Installation

```bash
npm install jsfeat
```

## Usage

```typescript
import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur, cannyEdges } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';

// Convert image to grayscale
const gray = new Matrix(width, height, U8C1);
grayscale(imageData.data, width, height, gray, ColorCode.RGBA2GRAY);

// Detect edges
const edges = new Matrix(width, height, U8C1);
gaussianBlur(gray, gray, 5, 0);
cannyEdges(gray, edges, 20, 40);

// Detect corners
const corners = Array.from({ length: 1000 }, () => new Keypoint());
const count = fastCorners(gray, corners, 20);
```

## Modules

| Module | Import | Description |
|--------|--------|-------------|
| Core | `jsfeat/core` | Matrix, Keypoint, Pyramid, data types |
| Math | `jsfeat/math` | Linear algebra, matrix operations, SVD |
| Image Processing | `jsfeat/imgproc` | Grayscale, blur, edges, derivatives |
| Features | `jsfeat/features` | FAST, YAPE, ORB feature detection |
| Optical Flow | `jsfeat/flow` | Lucas-Kanade sparse optical flow |
| Detection | `jsfeat/detect` | HAAR and BBF cascade classifiers |
| Motion | `jsfeat/motion` | RANSAC, LMEDS motion estimation |
| Transform | `jsfeat/transform` | Affine and perspective transforms |
| Cascades | `jsfeat/cascades` | Pre-trained detector models |

## Development

```bash
npm install
npm test          # Run tests
npm run build     # Build library
npm run docs      # Generate API docs
```

## License

MIT -- Original library by [Eugene Zatepyakin](http://www.inspirit.ru/)
