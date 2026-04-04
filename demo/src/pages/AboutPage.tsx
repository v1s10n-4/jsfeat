import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
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
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> GitHub Repository{' '}
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
