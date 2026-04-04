/**
 * Responsive grid of demo cards, grouped by category.
 */

import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { demoCategories } from '@/lib/demos';

export default function DemoGrid() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-8">
      {Array.from(demoCategories.entries()).map(([category, demos]) => (
        <section key={category}>
          <h2 className="text-lg font-semibold mb-3">{category}</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {demos.map((demo) => (
              <Card
                key={demo.id}
                size="sm"
                className="cursor-pointer transition-shadow hover:ring-2 hover:ring-primary/40"
                onClick={() => navigate(`/demos/${demo.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/demos/${demo.id}`);
                  }
                }}
              >
                <CardHeader>
                  <CardTitle>{demo.title}</CardTitle>
                  <CardDescription>{demo.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{demo.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
