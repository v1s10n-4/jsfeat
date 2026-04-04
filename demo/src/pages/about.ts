/* ------------------------------------------------------------------ *
 *  About page
 * ------------------------------------------------------------------ */

export function renderAbout(container: HTMLElement): void {
  let html = `<div class="page">`;

  html += `<h1 class="about-title">jsfeat</h1>`;
  html += `<p class="about-tagline">Modern TypeScript Computer Vision Library</p>`;

  html += `<p class="about-desc">
    jsfeat is a comprehensive computer vision library written in TypeScript,
    providing high-performance image processing, feature detection, object
    detection, optical flow, and geometric transform algorithms that run
    entirely in the browser. Originally created as a JavaScript library,
    it has been fully ported to TypeScript with strict typing, ES module
    support, and tree-shakeable exports.
  </p>`;

  // Feature list
  html += `<h2 class="about-heading">Features</h2>`;
  html += `<ul class="about-features">`;
  const features = [
    ['Image Processing', 'Grayscale conversion, Gaussian and box blur, Canny edges, Sobel and Scharr derivatives, histogram equalization, pyramid downsampling, integral images, affine warping'],
    ['Feature Detection', 'FAST-16 corners, YAPE and YAPE06 keypoints, ORB descriptors with oriented BRIEF'],
    ['Optical Flow', 'Pyramid-based sparse Lucas-Kanade tracker with Scharr gradients'],
    ['Object Detection', 'Haar cascade (single and multi-scale) and BBF (Brightness Binary Feature) detectors with rectangle grouping'],
    ['Motion Estimation', 'RANSAC and Least Median of Squares with affine and homography motion models'],
    ['Linear Algebra', 'Matrix arithmetic, LU and Cholesky solvers, SVD decomposition, eigenvalue computation'],
    ['Geometric Transforms', 'Affine (3-point) and perspective (4-point) transforms with inversion'],
  ];
  for (const [title, desc] of features) {
    html += `<li><strong>${title}</strong> &mdash; ${desc}</li>`;
  }
  html += `</ul>`;

  // Links
  html += `<h2 class="about-heading">Links</h2>`;
  html += `<div class="about-links">`;
  html += `<a href="https://github.com/v1s10n-4/jsfeat" target="_blank" rel="noopener" class="about-link">GitHub Repository</a>`;
  html += `<a href="#/api" class="about-link">API Reference</a>`;
  html += `</div>`;

  // Credits
  html += `<h2 class="about-heading">Credits</h2>`;
  html += `<p class="about-desc">
    Originally created by <strong>Eugene Zatepyakin</strong>
    (<a href="http://inspirit.ru/" target="_blank" rel="noopener" class="about-inline-link">inspirit.ru</a>)
    as a pure JavaScript computer vision library.
    TypeScript port with modern ES module architecture, strict types, and
    enhanced API surface.
  </p>`;

  // License
  html += `<h2 class="about-heading">License</h2>`;
  html += `<p class="about-desc">
    Released under the <strong>MIT License</strong>. Free for commercial and
    non-commercial use.
  </p>`;

  html += `</div>`;

  // Styles
  html += `<style>
    .page { max-width: 700px; margin: 0 auto; }
    .about-title { color: var(--accent); font-size: 2.2rem; margin-bottom: 4px; }
    .about-tagline {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .about-heading {
      color: var(--accent);
      font-size: 1.1rem;
      margin-top: 28px;
      margin-bottom: 12px;
    }

    .about-desc {
      color: var(--text-muted);
      line-height: 1.7;
      font-size: 0.92rem;
      margin-bottom: 8px;
      max-width: none;
    }

    .about-features {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .about-features li {
      padding: 8px 14px;
      margin-bottom: 6px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .about-features li strong {
      color: var(--text);
    }

    .about-links {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .about-link {
      display: inline-block;
      padding: 8px 20px;
      border: 1px solid var(--accent);
      border-radius: 6px;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.88rem;
      transition: background 0.12s, color 0.12s;
    }
    .about-link:hover {
      background: var(--accent);
      color: #fff;
    }

    .about-inline-link {
      color: var(--accent);
      text-decoration: none;
    }
    .about-inline-link:hover { text-decoration: underline; }
  </style>`;

  container.innerHTML = html;
}
