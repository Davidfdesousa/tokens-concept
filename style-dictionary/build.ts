import fs from 'node:fs';
import path from 'node:path';
import StyleDictionary, { TransformedToken } from 'style-dictionary';

// Constants
const ROOT = process.cwd();
const MERGED = path.join(ROOT, '.tmp', 'merged.tokens.json');
const DEFAULT_THEME = 'Light';

const mergedTree = JSON.parse(fs.readFileSync(MERGED, 'utf8'));

// Types
interface TokenTree {
  Semantics?: any;
  Brands?: any;
  Global?: any;
}

interface DiscoveryResult {
  brands: string[];
  themes: string[];
}

/**
 * Função unificada para descobrir marcas e temas do JSON
 * Evita duplicação de lógica de traversal
 */
function discoverBrandsAndThemes(tree: TokenTree): DiscoveryResult {
  const brandsSet = new Set<string>();
  const themesSet = new Set<string>();
  
  function traverseForModes(obj: any, isSemantics = false) {
    if (Array.isArray(obj)) {
      obj.forEach(item => traverseForModes(item, isSemantics));
      return;
    }
    
    if (!obj || typeof obj !== 'object') return;
    
    // Coletar modos de $extensions.mode
    if (obj.$extensions?.mode && typeof obj.$extensions.mode === 'object') {
      Object.keys(obj.$extensions.mode).forEach(mode => {
        if (isSemantics) {
          themesSet.add(mode);
        } else {
          brandsSet.add(mode);
        }
      });
    }
    
    // Continuar traversal
    Object.values(obj).forEach(value => traverseForModes(value, isSemantics));
  }
  
  // Descobrir temas em Semantics
  if (tree.Semantics) {
    traverseForModes(tree.Semantics, true);
  }
  
  // Descobrir marcas em Brands
  if (tree.Brands) {
    traverseForModes(tree.Brands, false);
  }
  
  return {
    brands: Array.from(brandsSet).sort(),
    themes: Array.from(themesSet).sort()
  };
}

const { brands: availableBrands, themes: availableThemes } = discoverBrandsAndThemes(mergedTree);
console.log(`📋 Marcas descobertas: ${availableBrands.join(', ')}`);
console.log(`🎨 Temas descobertos: ${availableThemes.join(', ')}`);

// Configuration constants
const STRIP_SEGMENTS = new Set(['Semantics', 'Brands', 'Global']);
const COLOR_BRANCHES = new Set(['color', 'text', 'container', 'feedback', 'action', 'stroke']);

/**
 * Converte string para snake_case
 */
const toSnake = (str: string): string =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^\w]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

/**
 * Getter seguro para objetos aninhados
 */
const getNestedValue = (obj: any, pathArr: string[]): any =>
  pathArr.reduce((acc, k) => acc?.[k], obj);

/**
 * Resolve referências de tokens ({path.to.token})
 */
function resolveReference(ref: string, visited = new Set<string>()): string | undefined {
  const match = /^\{([^}]+)\}$/.exec(ref.trim());
  if (!match) return ref;
  
  const refPath = match[1];
  if (visited.has(refPath)) {
    console.warn(`Circular reference detected: ${refPath}`);
    return undefined;
  }
  
  visited.add(refPath);
  const pathParts = refPath.split('.');
  const target = getNestedValue(mergedTree, pathParts);
  
  if (target?.value) {
    const value = target.value;
    return typeof value === 'string' && value.includes('{') 
      ? resolveReference(value, visited) 
      : value;
  }
  
  if (typeof target === 'string') {
    return target.includes('{') 
      ? resolveReference(target, visited) 
      : target;
  }
  
  return undefined;
}

/**
 * Extrai valor específico do modo para um token
 */
function extractModeValue(token: any, modeKey: string): string | undefined {
  const modes = token?.original?.$extensions?.mode;
  if (!modes) return undefined;
  
  const rawValue = modes[modeKey];
  return typeof rawValue === 'string' 
    ? resolveReference(rawValue) ?? rawValue 
    : undefined;
}

// === value transforms ===
StyleDictionary.registerTransform({
  name: 'value/resolve-refs',
  type: 'value',
  matcher: (token: TransformedToken) => {
    return typeof token.value === 'string' && token.value.includes('{');
  },
  transformer: (token: TransformedToken) => {
    const resolved = resolveReference(token.value as string);
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
  matcher: (t) => t.path[0] === 'Semantics' && COLOR_BRANCHES.has(t.path[1]),
});

StyleDictionary.registerFilter({
  name: 'filter/brands',
  matcher: (t) => t.path[0] === 'Brands',
});

StyleDictionary.registerFilter({
  name: 'filter/global',
  matcher: (t) => t.path[0] === 'Global',
});

/**
 * Valida se a marca existe e retorna tema padrão
 */
function validateBrandAndGetDefaultTheme(brand: string): string {
  if (!brand) {
    throw new Error('Brand option is required');
  }
  
  if (!availableBrands.includes(brand)) {
    throw new Error(`Brand "${brand}" not found. Available brands: ${availableBrands.join(', ')}`);
  }

  return availableThemes.includes(DEFAULT_THEME) ? DEFAULT_THEME : availableThemes[0];
}

/**
 * Processa tokens para um tema/marca específico
 */
function processTokensForMode(tokens: TransformedToken[], brand: string, theme: string) {
  const result: Array<{ name: string; value: string }> = [];
  
  for (const token of tokens) {
    let value: string;
    
    if (token.path[0] === 'Semantics') {
      value = extractModeValue(token, theme) ?? token.value;
    } else if (token.path[0] === 'Brands') {
      value = extractModeValue(token, brand) ?? token.value;
    } else if (token.path[0] === 'Global') {
      value = token.value as string;
    } else {
      continue;
    }
    
    result.push({ name: token.name, value });
  }
  
  return result;
}

// === formatters ===
StyleDictionary.registerFormat({
  name: 'format/dds-css-with-themes',
  formatter: ({ dictionary, file }) => {
    const brand = (file.options as any)?.brand;
    const defaultTheme = validateBrandAndGetDefaultTheme(brand);
    
    const cssDecl = (name: string, value: string) => `  ${name}: ${value};`;
    
    // Processar tema padrão
    const defaultTokens = processTokensForMode(dictionary.allTokens, brand, defaultTheme);
    const defaultLines = defaultTokens.map(({ name, value }) => cssDecl(name, value));

    const blocks: string[] = [];

    // Bloco padrão
    const defaultSelector = defaultTheme === DEFAULT_THEME 
      ? ':root,\n:root[data-color-scheme="Light"]' 
      : `:root,\n:root[data-color-scheme="${defaultTheme}"]`;
      
    blocks.push(`${defaultSelector} {
${defaultLines.join('\n')}
}`);

    // Outros temas (apenas cores)
    for (const theme of availableThemes) {
      if (theme === defaultTheme) continue;
      
      const themeLines: string[] = [];
      for (const token of dictionary.allTokens) {
        if (token.path[0] === 'Semantics' && COLOR_BRANCHES.has(token.path[1])) {
          const value = extractModeValue(token, theme);
          if (value) themeLines.push(cssDecl(token.name, value));
        }
      }
      
      if (themeLines.length) {
        blocks.push(`:root[data-color-scheme="${theme}"] {
${themeLines.join('\n')}
}`);
      }
    }

    return blocks.join('\n\n') + '\n';
  },
});

// SCSS (apenas tema padrão)
StyleDictionary.registerFormat({
  name: 'format/dds-scss-light',
  formatter: ({ dictionary, file }) => {
    const brand = (file.options as any)?.brand;
    const defaultTheme = validateBrandAndGetDefaultTheme(brand);

    const tokens = processTokensForMode(dictionary.allTokens, brand, defaultTheme);
    const lines = tokens.map(({ name, value }) => `${name}: ${value};`);

    return lines.join('\n') + '\n';
  },
});

/**
 * Gera configuração de plataforma para uma marca específica
 */
function createPlatformConfig(brand: string) {
  const brandLower = brand.toLowerCase();
  
  return {
    [`${brandLower}_css`]: {
      transformGroup: 'dds/css',
      buildPath: `dist/tokens/${brandLower}/css/`,
      files: [{
        destination: 'tokens.css',
        format: 'format/dds-css-with-themes',
        // filter: 'filter/no-primitives', // TEMPORARILY REMOVED
        options: { brand }
      }]
    },
    [`${brandLower}_scss`]: {
      transformGroup: 'dds/scss',
      buildPath: `dist/tokens/${brandLower}/scss/`,
      files: [{
        destination: 'tokens.scss',
        format: 'format/dds-scss-light',
        // filter: 'filter/no-primitives', // TEMPORARILY REMOVED
        options: { brand }
      }]
    }
  };
}

// Gerar todas as plataformas dinamicamente
const platforms = availableBrands.reduce((acc, brand) => ({
  ...acc,
  ...createPlatformConfig(brand)
}), {});

const sd = StyleDictionary.extend({
  source: [MERGED],
  platforms
});

// build
await sd.buildAllPlatforms();
console.log('✔ Tokens gerados em dist/tokens');
