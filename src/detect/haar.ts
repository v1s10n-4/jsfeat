/**
 * HAAR cascade object detection.
 *
 * Ported from legacy/jsfeat_haar.js.
 *
 * Original code is a rewrite from https://github.com/mtschirs/js-objectdetect
 * @author Martin Tschirsich / http://www.tu-darmstadt.de/~m_t
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

export interface HaarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  neighbor: number;
  confidence: number;
}

export interface GroupedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  neighbors: number;
  confidence: number;
}

export const EDGES_DENSITY = 0.07;

function _groupFunc(r1: { x: number; y: number; width: number }, r2: { x: number; y: number; width: number }): boolean {
  const distance = (r1.width * 0.25 + 0.5) | 0;

  return r2.x <= r1.x + distance &&
         r2.x >= r1.x - distance &&
         r2.y <= r1.y + distance &&
         r2.y >= r1.y - distance &&
         r2.width <= ((r1.width * 1.5 + 0.5) | 0) &&
         ((r2.width * 1.5 + 0.5) | 0) >= r1.width;
}

/**
 * Detect objects at a single scale.
 */
export function haarDetectSingleScale(
  intSum: Int32Array | Float32Array | number[],
  intSqsum: Int32Array | Float32Array | Float64Array | number[],
  intTilted: Int32Array | Float32Array | number[],
  intCannySum: Int32Array | Float32Array | number[] | null,
  width: number,
  height: number,
  scale: number,
  classifier: { size: number[]; complexClassifiers: any[] },
): HaarRect[] {
  const win_w = (classifier.size[0] * scale) | 0;
  const win_h = (classifier.size[1] * scale) | 0;
  const step_x = (0.5 * scale + 1.5) | 0;
  const step_y = step_x;
  let i: number, j: number, k: number, x: number, y: number;
  const ex = (width - win_w) | 0;
  const ey = (height - win_h) | 0;
  const w1 = (width + 1) | 0;
  let edge_dens: number, mean: number, variance: number, std: number;
  const inv_area = 1.0 / (win_w * win_h);
  let stages: any[], stage: any, trees: any[], tree: any;
  let sn: number, tn: number, fn: number, found: boolean = true;
  let stage_thresh: number, stage_sum: number, tree_sum: number;
  let feature: any, features: any[];
  let fi_a: number, fi_b: number, fi_c: number, fi_d: number, fw: number, fh: number;

  let ii_a = 0;
  const ii_b = win_w;
  const ii_c = win_h * w1;
  const ii_d = ii_c + win_w;
  const edges_thresh = ((win_w * win_h) * 0xff * EDGES_DENSITY) | 0;

  const rects: HaarRect[] = [];
  for (y = 0; y < ey; y += step_y) {
    ii_a = y * w1;
    for (x = 0; x < ex; x += step_x, ii_a += step_x) {

      mean = intSum[ii_a]
           - intSum[ii_a + ii_b]
           - intSum[ii_a + ii_c]
           + intSum[ii_a + ii_d];

      // canny prune
      if (intCannySum) {
        edge_dens = (intCannySum[ii_a]
                   - intCannySum[ii_a + ii_b]
                   - intCannySum[ii_a + ii_c]
                   + intCannySum[ii_a + ii_d]);
        if (edge_dens < edges_thresh || mean < 20) {
          x += step_x; ii_a += step_x;
          continue;
        }
      }

      mean *= inv_area;
      variance = (intSqsum[ii_a]
                 - intSqsum[ii_a + ii_b]
                 - intSqsum[ii_a + ii_c]
                 + intSqsum[ii_a + ii_d]) * inv_area - mean * mean;

      std = variance > 0. ? Math.sqrt(variance) : 1;

      stages = classifier.complexClassifiers;
      sn = stages.length;
      found = true;
      for (i = 0; i < sn; ++i) {
        stage = stages[i];
        stage_thresh = stage.threshold;
        trees = stage.simpleClassifiers;
        tn = trees.length;
        stage_sum = 0;
        for (j = 0; j < tn; ++j) {
          tree = trees[j];
          tree_sum = 0;
          features = tree.features;
          fn = features.length;
          if (tree.tilted === 1) {
            for (k = 0; k < fn; ++k) {
              feature = features[k];
              fi_a = ~~(x + feature[0] * scale) + ~~(y + feature[1] * scale) * w1;
              fw = ~~(feature[2] * scale);
              fh = ~~(feature[3] * scale);
              fi_b = fw * w1;
              fi_c = fh * w1;

              tree_sum += (intTilted[fi_a]
                         - intTilted[fi_a + fw + fi_b]
                         - intTilted[fi_a - fh + fi_c]
                         + intTilted[fi_a + fw - fh + fi_b + fi_c]) * feature[4];
            }
          } else {
            for (k = 0; k < fn; ++k) {
              feature = features[k];
              fi_a = ~~(x + feature[0] * scale) + ~~(y + feature[1] * scale) * w1;
              fw = ~~(feature[2] * scale);
              fh = ~~(feature[3] * scale);
              fi_c = fh * w1;

              tree_sum += (intSum[fi_a]
                         - intSum[fi_a + fw]
                         - intSum[fi_a + fi_c]
                         + intSum[fi_a + fi_c + fw]) * feature[4];
            }
          }
          stage_sum += (tree_sum * inv_area < tree.threshold * std) ? tree.left_val : tree.right_val;
        }
        if (stage_sum < stage_thresh) {
          found = false;
          break;
        }
      }

      if (found) {
        rects.push({
          x: x,
          y: y,
          width: win_w,
          height: win_h,
          neighbor: 1,
          confidence: stage_sum,
        });
        x += step_x; ii_a += step_x;
      }
    }
  }
  return rects;
}

/**
 * Detect objects at multiple scales.
 */
export function haarDetectMultiScale(
  intSum: Int32Array | Float32Array | number[],
  intSqsum: Int32Array | Float32Array | Float64Array | number[],
  intTilted: Int32Array | Float32Array | number[],
  intCannySum: Int32Array | Float32Array | number[] | null,
  width: number,
  height: number,
  classifier: { size: number[]; complexClassifiers: any[] },
  scaleFactor: number = 1.2,
  scaleMin: number = 1.0,
): HaarRect[] {
  const win_w = classifier.size[0];
  const win_h = classifier.size[1];
  let rects: HaarRect[] = [];
  while (scaleMin * win_w < width && scaleMin * win_h < height) {
    rects = rects.concat(haarDetectSingleScale(intSum, intSqsum, intTilted, intCannySum, width, height, scaleMin, classifier));
    scaleMin *= scaleFactor;
  }
  return rects;
}

/**
 * OpenCV-style rectangle grouping with union-find.
 */
export function groupRectangles(rects: HaarRect[], minNeighbors: number = 1): GroupedRect[] {
  let i: number, j: number, n = rects.length;
  const node: { parent: number; element: HaarRect | null; rank: number }[] = [];
  for (i = 0; i < n; ++i) {
    node[i] = {
      parent: -1,
      element: rects[i],
      rank: 0,
    };
  }
  for (i = 0; i < n; ++i) {
    if (!node[i].element)
      continue;
    let root = i;
    while (node[root].parent != -1)
      root = node[root].parent;
    for (j = 0; j < n; ++j) {
      if (i != j && node[j].element && _groupFunc(node[i].element!, node[j].element!)) {
        let root2 = j;

        while (node[root2].parent != -1)
          root2 = node[root2].parent;

        if (root2 != root) {
          if (node[root].rank > node[root2].rank)
            node[root2].parent = root;
          else {
            node[root].parent = root2;
            if (node[root].rank == node[root2].rank)
              node[root2].rank++;
            root = root2;
          }

          /* compress path from node2 to the root: */
          let temp: number, node2 = j;
          while (node[node2].parent != -1) {
            temp = node2;
            node2 = node[node2].parent;
            node[temp].parent = root;
          }

          /* compress path from node to the root: */
          node2 = i;
          while (node[node2].parent != -1) {
            temp = node2;
            node2 = node[node2].parent;
            node[temp].parent = root;
          }
        }
      }
    }
  }
  const idx_seq: number[] = [];
  let class_idx = 0;
  for (i = 0; i < n; i++) {
    j = -1;
    let node1 = i;
    if (node[node1].element) {
      while (node[node1].parent != -1)
        node1 = node[node1].parent;
      if (node[node1].rank >= 0)
        node[node1].rank = ~class_idx++;
      j = ~node[node1].rank;
    }
    idx_seq[i] = j;
  }

  const comps: { neighbors: number; x: number; y: number; width: number; height: number; confidence: number }[] = [];
  for (i = 0; i < class_idx + 1; ++i) {
    comps[i] = {
      neighbors: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      confidence: 0,
    };
  }

  // count number of neighbors
  for (i = 0; i < n; ++i) {
    const r1 = rects[i];
    const idx = idx_seq[i];

    if (comps[idx].neighbors == 0)
      comps[idx].confidence = r1.confidence;

    ++comps[idx].neighbors;

    comps[idx].x += r1.x;
    comps[idx].y += r1.y;
    comps[idx].width += r1.width;
    comps[idx].height += r1.height;
    comps[idx].confidence = Math.max(comps[idx].confidence, r1.confidence);
  }

  const seq2: GroupedRect[] = [];
  // calculate average bounding box
  for (i = 0; i < class_idx; ++i) {
    n = comps[i].neighbors;
    if (n >= minNeighbors)
      seq2.push({
        x: (comps[i].x * 2 + n) / (2 * n),
        y: (comps[i].y * 2 + n) / (2 * n),
        width: (comps[i].width * 2 + n) / (2 * n),
        height: (comps[i].height * 2 + n) / (2 * n),
        neighbors: comps[i].neighbors,
        confidence: comps[i].confidence,
      });
  }

  const result_seq: GroupedRect[] = [];
  n = seq2.length;
  // filter out small face rectangles inside large face rectangles
  for (i = 0; i < n; ++i) {
    const r1 = seq2[i];
    let flag = true;
    for (j = 0; j < n; ++j) {
      const r2 = seq2[j];
      const distance = (r2.width * 0.25 + 0.5) | 0;

      if (i != j &&
         r1.x >= r2.x - distance &&
         r1.y >= r2.y - distance &&
         r1.x + r1.width <= r2.x + r2.width + distance &&
         r1.y + r1.height <= r2.y + r2.height + distance &&
         (r2.neighbors > Math.max(3, r1.neighbors) || r1.neighbors < 3)) {
        flag = false;
        break;
      }
    }

    if (flag)
      result_seq.push(r1);
  }
  return result_seq;
}
