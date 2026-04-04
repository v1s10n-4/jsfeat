import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  'Image Processing',
  'Feature Detection',
  'Optical Flow',
  'Object Detection',
  'Motion Estimation',
  'Linear Algebra',
  'Geometric Transforms',
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">jsfeat</h1>
        <p className="text-xl text-muted-foreground">
          Modern TypeScript Computer Vision Library
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p>
            jsfeat is a comprehensive computer vision library for the browser.
            Real-time image processing, feature detection, optical flow, object
            detection, and motion estimation — pure TypeScript, zero
            dependencies.
          </p>
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <Badge key={f} variant="secondary">
                {f}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="https://github.com/v1s10n-4/jsfeat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Github className="h-4 w-4" /> GitHub Repository{' '}
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            to="/docs"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            API Reference
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Original library by{' '}
            <a
              href="http://www.inspirit.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Eugene Zatepyakin
            </a>
            . TypeScript port and modernization.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">MIT License</p>
    </div>
  );
}
