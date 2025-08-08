import fs from 'node:fs';
import path from 'node:path';
import StyleDictionary, { TransformedToken } from 'style-dictionary';

const ROOT = process.cwd();
const MERGED = path.join(ROOT, '.tmp', 'merged.tokens.json');

let mergedTree = JSON.parse(fs.readFileSync(MERGED, 'utf8'));

// Função para descobrir todas as marcas disponíveis no JSON
function discoverBrands(tree: any): string[] {
  const brandsSet = new Set<string>();
  
  function traverse(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else if (obj && typeof obj === 'object') {
      // Procurar por $extensions.mode
      if (obj.$extensions?.mode && typeof obj.$extensions.mode === 'object') {
        Object.keys(obj.$extensions.mode).forEach(brand => {
          // Filtrar apenas brands, não modos de cor
          if (!['light', 'dark', 'contrast'].includes(brand)) {
            brandsSet.add(brand);
          }
        });
      }
      
      // Continuar traversing
      Object.values(obj).forEach(traverse);
    }
  }
  
  traverse(tree);
  return Array.from(brandsSet).sort();
}

const availableBrands = discoverBrands(mergedTree);
console.log(`📋 Marcas descobertas: ${availableBrands.join(', ')}`);

const STRIP_SEGMENTS = new Set(['Semantics', 'Brands', 'Global']);
const SECONDARY_COLOR_BRANCHES = new Set(['color', 'text', 'container', 'feedback', 'action', 'stroke']);

const toSnake = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^\w]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

function get(obj: any, pathArr: string[]): any {
  return pathArr.reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}

function resolveRefString(ref: string, visited: Set<string> = new Set()): string | undefined {
  const m = /^\{([^}]+)\}$/.exec(ref.trim());
  if (!m) return ref; // retorna o valor original se não for uma referência
  
  const refPath = m[1];
  if (visited.has(refPath)) {
    console.warn(`Circular reference detected: ${refPath}`);
    return undefined;
  }
  
  visited.add(refPath);
  const pathParts = refPath.split('.');
  const hit = get(mergedTree, pathParts);
  
  if (hit && typeof hit === 'object' && 'value' in hit) {
    const value = hit.value;
    if (typeof value === 'string' && value.includes('{')) {
      // Resolver recursivamente se o valor contém uma referência
      return resolveRefString(value, visited);
    }
    return value;
  }
  if (typeof hit === 'string') {
    if (hit.includes('{')) {
      // Resolver recursivamente se a string contém uma referência
      return resolveRefString(hit, visited);
    }
    return hit;
  }
  return undefined;
}

function pickModeValue(token: any, key: string): string | undefined {
  const modes = token?.original?.$extensions?.mode;
  if (!modes) return undefined;
  const raw = modes[key];
  if (typeof raw === 'string') {
    return resolveRefString(raw) ?? raw;
  }
  return undefined;
}

// === value transforms ===
StyleDictionary.registerTransform({
  name: 'value/resolve-refs',
  type: 'value',
  matcher: (token: TransformedToken) => {
    return typeof token.value === 'string' && token.value.includes('{');
  },
  transformer: (token: TransformedToken) => {
    const resolved = resolveRefString(token.value as string);
    return resolved ?? token.value;
  },
});

// === name transforms ===
StyleDictionary.registerTransform({
  name: 'name/dds-css',
  type: 'name',
  transformer: (token: TransformedToken) => {
    const parts = token.path
      .filter((p) => !STRIP_SEGMENTS.has(p))
      .map((p) => toSnake(p))
      .filter(Boolean);

    return `--dds_${parts.join('_')}`;
  },
});

StyleDictionary.registerTransform({
  name: 'name/dds-scss',
  type: 'name',
  transformer: (token: TransformedToken) => {
    const parts = token.path
      .filter((p) => !STRIP_SEGMENTS.has(p))
      .map((p) => toSnake(p))
      .filter(Boolean);

    return `$dds_${parts.join('_')}`;
  },
});

// === transform groups (AGORA REGISTRADOS) ===
const cssGroup = ['value/resolve-refs', 'attribute/cti', 'name/dds-css', 'color/hex', 'size/px'];
const scssGroup = ['value/resolve-refs', 'attribute/cti', 'name/dds-scss', 'color/hex', 'size/px'];

StyleDictionary.registerTransformGroup({
  name: 'dds/css',
  transforms: cssGroup,
});

StyleDictionary.registerTransformGroup({
  name: 'dds/scss',
  transforms: scssGroup,
});

// === filters ===
StyleDictionary.registerFilter({
  name: 'filter/no-primitives',
  matcher: (t) => !t.path.includes('Primitives'),
});

StyleDictionary.registerFilter({
  name: 'filter/semantics',
  matcher: (t) => t.path[0] === 'Semantics',
});

StyleDictionary.registerFilter({
  name: 'filter/semantics-color-only',
  matcher: (t) => t.path[0] === 'Semantics' && SECONDARY_COLOR_BRANCHES.has(t.path[1]),
});

StyleDictionary.registerFilter({
  name: 'filter/brands',
  matcher: (t) => t.path[0] === 'Brands',
});

StyleDictionary.registerFilter({
  name: 'filter/global',
  matcher: (t) => t.path[0] === 'Global',
});

// === formatters ===
StyleDictionary.registerFormat({
  name: 'format/dds-css-with-themes',
  formatter: ({ dictionary, file }) => {
    const brand = (file.options as any)?.brand;
    
    if (!brand) {
      throw new Error('Brand option is required for format/dds-css-with-themes');
    }
    
    if (!availableBrands.includes(brand)) {
      throw new Error(`Brand "${brand}" not found. Available brands: ${availableBrands.join(', ')}`);
    }

    function cssDecl(name: string, value: string) {
      return `  ${name}: ${value};`;
    }

    // LIGHT (completo)
    const lightLines: string[] = [];
    for (const t of dictionary.allTokens) {
      if (t.path[0] === 'Semantics') {
        const v = pickModeValue(t, 'light') ?? t.value;
        lightLines.push(cssDecl(t.name, v));
      } else if (t.path[0] === 'Brands') {
        const v = pickModeValue(t, brand) ?? t.value;
        lightLines.push(cssDecl(t.name, v));
      } else if (t.path[0] === 'Global') {
        lightLines.push(cssDecl(t.name, t.value as string));
      }
    }

    // DARK (apenas cores de Semantics)
    const darkLines: string[] = [];
    for (const t of dictionary.allTokens) {
      if (t.path[0] === 'Semantics' && SECONDARY_COLOR_BRANCHES.has(t.path[1])) {
        const v = pickModeValue(t, 'dark');
        if (v) darkLines.push(cssDecl(t.name, v));
      }
    }

    // CONTRAST (apenas cores de Semantics)
    const contrastLines: string[] = [];
    for (const t of dictionary.allTokens) {
      if (t.path[0] === 'Semantics' && SECONDARY_COLOR_BRANCHES.has(t.path[1])) {
        const v = pickModeValue(t, 'contrast');
        if (v) contrastLines.push(cssDecl(t.name, v));
      }
    }

    const blocks: string[] = [];

    // default/light
    blocks.push(`:root,
:root[data-color-scheme="light"] {
${lightLines.join('\n')}
}`);

    // dark
    if (darkLines.length) {
      blocks.push(`:root[data-color-scheme="dark"] {
${darkLines.join('\n')}
}`);
    }

    // contrast
    if (contrastLines.length) {
      blocks.push(`:root[data-color-scheme="contrast"] {
${contrastLines.join('\n')}
}`);
    }

    return blocks.join('\n\n') + '\n';
  },
});

// SCSS (apenas light – estático)
StyleDictionary.registerFormat({
  name: 'format/dds-scss-light',
  formatter: ({ dictionary, file }) => {
    const brand = (file.options as any)?.brand;
    
    if (!brand) {
      throw new Error('Brand option is required for format/dds-scss-light');
    }
    
    if (!availableBrands.includes(brand)) {
      throw new Error(`Brand "${brand}" not found. Available brands: ${availableBrands.join(', ')}`);
    }

    const lines: string[] = [];

    for (const t of dictionary.allTokens) {
      if (t.path[0] === 'Semantics') {
        const v = pickModeValue(t, 'light') ?? t.value;
        lines.push(`${t.name}: ${v};`);
      } else if (t.path[0] === 'Brands') {
        const v = pickModeValue(t, brand) ?? t.value;
        lines.push(`${t.name}: ${v};`);
      } else if (t.path[0] === 'Global') {
        lines.push(`${t.name}: ${t.value};`);
      }
    }

    return lines.join('\n') + '\n';
  },
});

// === config ===
// Gerar plataformas dinamicamente baseado nas marcas disponíveis
const platforms: any = {};

for (const brand of availableBrands) {
  const brandLower = brand.toLowerCase();
  
  // CSS platform
  platforms[`${brandLower}_css`] = {
    transformGroup: 'dds/css',
    buildPath: `dist/tokens/${brandLower}/css/`,
    files: [
      {
        destination: 'tokens.css',
        format: 'format/dds-css-with-themes',
        filter: 'filter/no-primitives',
        options: { brand }
      }
    ]
  };
  
  // SCSS platform
  platforms[`${brandLower}_scss`] = {
    transformGroup: 'dds/scss',
    buildPath: `dist/tokens/${brandLower}/scss/`,
    files: [
      {
        destination: 'tokens.scss',
        format: 'format/dds-scss-light',
        filter: 'filter/no-primitives',
        options: { brand }
      }
    ]
  };
}

const sd = StyleDictionary.extend({
  source: [MERGED],
  platforms
});

// build
await sd.buildAllPlatforms();
console.log('✔ Tokens gerados em dist/tokens');
