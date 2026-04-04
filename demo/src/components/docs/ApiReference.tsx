import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import apiData from '../../../../docs/api.json';

// ---------------------------------------------------------------------------
// Demo route lookup -- maps function names to demo routes
// ---------------------------------------------------------------------------

const demoRoutes: Record<string, string> = {
  grayscale: '/demos/grayscale',
  cannyEdges: '/demos/cannyEdges',
  boxBlurGray: '/demos/boxBlur',
  gaussianBlur: '/demos/gaussianBlur',
  pyrDown: '/demos/pyrDown',
  equalizeHistogram: '/demos/equalizeHist',
  sobelDerivatives: '/demos/sobel',
  scharrDerivatives: '/demos/scharr',
  fastCorners: '/demos/fastCorners',
  yape06Detect: '/demos/yape06',
  orbDescribe: '/demos/orbMatch',
  haarDetectMultiScale: '/demos/haarFace',
  bbfDetect: '/demos/bbfFace',
  lucasKanade: '/demos/opticalFlowLK',
  warpAffine: '/demos/warpAffine',
  ransac: '/demos/homography',
};

// ---------------------------------------------------------------------------
// TypeDoc kind constants
// ---------------------------------------------------------------------------

const KIND_VARIABLE = 32;
const KIND_FUNCTION = 64;
const KIND_CLASS = 128;
const KIND_INTERFACE = 256;
const KIND_TYPE_ALIAS = 2097152;

// ---------------------------------------------------------------------------
// Module display names
// ---------------------------------------------------------------------------

const moduleDisplayNames: Record<string, string> = {
  core: 'Core',
  math: 'Math',
  imgproc: 'ImgProc',
  features: 'Features',
  flow: 'Flow',
  detect: 'Detect',
  motion: 'Motion',
  transform: 'Transform',
  cascades: 'Cascades',
};

// ---------------------------------------------------------------------------
// Type stringification
// ---------------------------------------------------------------------------

interface TypeNode {
  type: string;
  name?: string;
  value?: unknown;
  types?: TypeNode[];
  elementType?: TypeNode;
  declaration?: { children?: { name: string; type: TypeNode }[] };
  typeArguments?: TypeNode[];
  target?: unknown;
  operator?: string;
  package?: string;
  qualifiedName?: string;
  objectType?: TypeNode;
  indexType?: TypeNode;
}

const MAX_TYPE_DEPTH = 3;

function stringifyType(t: TypeNode | undefined, depth: number = 0): string {
  if (!t) return 'unknown';
  if (depth > MAX_TYPE_DEPTH) return t.name ?? '...';

  switch (t.type) {
    case 'intrinsic':
      return t.name ?? 'unknown';

    case 'reference':
      if (t.typeArguments?.length) {
        if (depth >= MAX_TYPE_DEPTH) return t.name ?? 'unknown';
        return `${t.name}<${t.typeArguments.map((a) => stringifyType(a, depth + 1)).join(', ')}>`;
      }
      return t.name ?? 'unknown';

    case 'union':
      return (t.types ?? []).map((u) => stringifyType(u, depth + 1)).join(' | ');

    case 'array':
      return `${stringifyType(t.elementType, depth + 1)}[]`;

    case 'literal':
      if (t.value === null) return 'null';
      if (typeof t.value === 'string') return `"${t.value}"`;
      return String(t.value);

    case 'reflection':
      if (depth >= MAX_TYPE_DEPTH) return 'object';
      if (t.declaration?.children) {
        const fields = t.declaration.children
          .map((c) => `${c.name}: ${stringifyType(c.type, depth + 1)}`)
          .join('; ');
        return `{ ${fields} }`;
      }
      return 'object';

    case 'indexedAccess':
      return `${stringifyType(t.objectType, depth + 1)}[${stringifyType(t.indexType, depth + 1)}]`;

    case 'typeOperator':
      return `${t.operator} ${stringifyType(t.target as TypeNode, depth + 1)}`;

    case 'query':
      return `typeof ${stringifyType(t as unknown as TypeNode, depth + 1)}`;

    default:
      return t.name ?? 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Signature builder
// ---------------------------------------------------------------------------

interface ParamNode {
  name: string;
  type?: TypeNode;
  flags?: { isOptional?: boolean };
}

interface SignatureNode {
  name: string;
  parameters?: ParamNode[];
  type?: TypeNode;
  comment?: { summary?: { kind: string; text: string }[] };
}

function buildSignature(name: string, sig: SignatureNode): string {
  const params = (sig.parameters ?? [])
    .map((p) => {
      const opt = p.flags?.isOptional ? '?' : '';
      return `${p.name}${opt}: ${stringifyType(p.type)}`;
    })
    .join(', ');
  const ret = stringifyType(sig.type);
  return `${name}(${params}): ${ret}`;
}

function getDescription(sig: SignatureNode): string {
  return (
    sig.comment?.summary
      ?.map((t) => t.text)
      .join('')
      .trim() ?? ''
  );
}

// ---------------------------------------------------------------------------
// Entry card component
// ---------------------------------------------------------------------------

interface EntryNode {
  name: string;
  kind: number;
  signatures?: SignatureNode[];
  comment?: { summary?: { kind: string; text: string }[] };
  children?: { name: string; kind: number; type?: TypeNode; comment?: { summary?: { kind: string; text: string }[] }; signatures?: SignatureNode[] }[];
  type?: TypeNode;
}

function kindLabel(kind: number): string {
  switch (kind) {
    case KIND_FUNCTION:
      return 'function';
    case KIND_CLASS:
      return 'class';
    case KIND_INTERFACE:
      return 'interface';
    case KIND_TYPE_ALIAS:
      return 'type';
    case KIND_VARIABLE:
      return 'const';
    default:
      return '';
  }
}

function EntryCard({ entry }: { entry: EntryNode }) {
  const label = kindLabel(entry.kind);
  const demoRoute = demoRoutes[entry.name];

  // Function entries
  if (entry.kind === KIND_FUNCTION && entry.signatures?.length) {
    const sig = entry.signatures[0];
    const sigStr = buildSignature(entry.name, sig);
    const desc = getDescription(sig);

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{label}</span>
            {entry.name}
            {demoRoute && (
              <Link
                to={demoRoute}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Try it &rarr;
              </Link>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
            <code>{sigStr}</code>
          </pre>
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
        </CardContent>
      </Card>
    );
  }

  // Class entries
  if (entry.kind === KIND_CLASS) {
    const desc =
      entry.comment?.summary
        ?.map((t) => t.text)
        .join('')
        .trim() ?? '';

    const members = (entry.children ?? []).filter(
      (c) => c.kind !== 512, // exclude constructor
    );

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{label}</span>
            {entry.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
          {members.length > 0 && (
            <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
              <code>
                {`class ${entry.name} {\n`}
                {members
                  .map((m) => {
                    if (m.signatures?.length) {
                      return `  ${buildSignature(m.name, m.signatures[0])};`;
                    }
                    return `  ${m.name}: ${stringifyType(m.type as TypeNode)};`;
                  })
                  .join('\n')}
                {'\n}'}
              </code>
            </pre>
          )}
        </CardContent>
      </Card>
    );
  }

  // Interface entries
  if (entry.kind === KIND_INTERFACE) {
    const desc =
      entry.comment?.summary
        ?.map((t) => t.text)
        .join('')
        .trim() ?? '';

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{label}</span>
            {entry.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
          {entry.children && entry.children.length > 0 && (
            <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
              <code>
                {`interface ${entry.name} {\n`}
                {entry.children
                  .map((m) => `  ${m.name}: ${stringifyType(m.type as TypeNode)};`)
                  .join('\n')}
                {'\n}'}
              </code>
            </pre>
          )}
        </CardContent>
      </Card>
    );
  }

  // Variable / const entries
  if (entry.kind === KIND_VARIABLE) {
    const desc =
      entry.comment?.summary
        ?.map((t) => t.text)
        .join('')
        .trim() ?? '';

    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{label}</span>
            {entry.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
            <code>{`const ${entry.name}: ${stringifyType(entry.type as TypeNode)}`}</code>
          </pre>
          {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
        </CardContent>
      </Card>
    );
  }

  // Type alias entries
  if (entry.kind === KIND_TYPE_ALIAS) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{label}</span>
            {entry.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
            <code>{`type ${entry.name} = ${stringifyType(entry.type as TypeNode)}`}</code>
          </pre>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ModuleData {
  name: string;
  children: EntryNode[];
}

export default function ApiReference() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(
    (apiData as { children: ModuleData[] }).children[0]?.name ?? 'core',
  );
  const isMobile = useMediaQuery('(max-width: 640px)');

  const modules = (apiData as { children: ModuleData[] }).children;

  const filteredModules = useMemo(() => {
    if (!search.trim()) return modules;
    const q = search.toLowerCase();
    return modules
      .map((mod) => ({
        ...mod,
        children: mod.children.filter((entry) =>
          entry.name.toLowerCase().includes(q),
        ),
      }))
      .filter((mod) => mod.children.length > 0);
  }, [modules, search]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">API Reference</h1>
        <p className="text-muted-foreground">
          Browse the full jsfeat API, generated from TypeScript source.
        </p>
      </div>

      <Input
        type="text"
        placeholder="Search functions, classes, types..."
        value={search}
        onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
        className="max-w-sm"
      />

      {isMobile ? (
        /* Mobile: select dropdown */
        <div className="space-y-4">
          <Select
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filteredModules.map((mod) => (
                <SelectItem key={mod.name} value={mod.name}>
                  {moduleDisplayNames[mod.name] ?? mod.name} ({mod.children.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-3">
            {filteredModules
              .find((m) => m.name === activeTab)
              ?.children.map((entry) => (
                <EntryCard key={entry.name} entry={entry} />
              ))}
          </div>
        </div>
      ) : (
        /* Desktop: tabs */
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as string)}
        >
          <TabsList className="flex-wrap">
            {filteredModules.map((mod) => (
              <TabsTrigger key={mod.name} value={mod.name}>
                {moduleDisplayNames[mod.name] ?? mod.name} ({mod.children.length})
              </TabsTrigger>
            ))}
          </TabsList>

          {filteredModules.map((mod) => (
            <TabsContent key={mod.name} value={mod.name}>
              <div className="space-y-3 mt-2">
                {mod.children.map((entry) => (
                  <EntryCard key={entry.name} entry={entry} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
