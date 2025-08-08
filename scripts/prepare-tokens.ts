/**
 * Script de preparação dos design tokens
 * 
 * Este script processa os arquivos JSON de tokens (primitives.json e semantics.json)
 * aplicando transformações e correções necessárias antes de serem processados pelo Style Dictionary.
 * 
 * Funcionalidades:
 * - Remove unidades incorretas (px em opacity, font-weight)
 * - Converte unidades de motion (px → ms)
 * - Expõe primitives no nível raiz
 * - Gera arquivo merged.tokens.json para o Style Dictionary
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'tokens');
const TMP = path.join(ROOT, '.tmp');
const OUT = path.join(TMP, 'merged.tokens.json');

type AnyObj = Record<string, any>;

/**
 * Lê um arquivo JSON e retorna seu conteúdo como objeto
 */
function readJson(file: string): AnyObj {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Escreve um objeto como JSON em um arquivo, criando diretórios se necessário
 */
function writeJson(file: string, data: AnyObj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}





/**
 * Remove a unidade 'px' de strings que representam números
 * Ex: "12px" → "12", "0.5px" → "0.5"
 * Usado para corrigir valores de opacity e font-weight que vieram com 'px' incorretamente
 */
function stripPxIfNumberString(s: string): string {
  const m = /^(-?\d+(\.\d+)?)px$/.exec(s.trim());
  return m ? m[1] : s;
}

/**
 * Mapeia valores de um objeto baseado no caminho (path) da propriedade
 * Permite aplicar transformações específicas baseadas na localização do valor na árvore
 * Ex: apenas valores em "Global.opacity.*" ou "Semantics.motion.*"
 */
function mapValuesByPath(obj: AnyObj, mapper: (value: any, pathArr: string[]) => any, pathArr: string[] = []): AnyObj {
  if (Array.isArray(obj)) return obj.map((v, i) => mapValuesByPath(v, mapper, [...pathArr, String(i)]));
  if (obj && typeof obj === 'object') {
    const out: AnyObj = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = mapValuesByPath(v, mapper, [...pathArr, k]);
    }
    return out;
  }
  return mapper(obj, pathArr);
}

/**
 * Função principal de preparação dos tokens
 * Aplica todas as transformações necessárias nos arquivos fonte e gera o arquivo merged
 */
function prepare() {
  // Lê os arquivos fonte de tokens
  const primitives = readJson(path.join(SRC, 'primitives.json'));
  const semanticsBrandsGlobal = readJson(path.join(SRC, 'semantics.json'));

  // 1) Coerções de valores específicas para corrigir unidades incorretas nos dados fonte
  // TODO: Estes fixes deveriam ser aplicados diretamente nos JSONs fonte no futuro
  const coerced = mapValuesByPath(semanticsBrandsGlobal, (val, p) => {
    if (typeof val !== 'string') return val;

    const pathStr = p.join('.');

    // 2.1) Opacity: remover 'px' incorreto (ex: "0.5px" → "0.5")
    if (pathStr.startsWith('Global.opacity')) {
      return stripPxIfNumberString(val);
    }

    // 2.2) Font weight: remover 'px' incorreto (ex: "700px" → "700")
    if (pathStr.includes('Brands.font.weight.bold')) {
      return stripPxIfNumberString(val);
    }

    // 2.3) Motion: converter px para ms (ex: "200px" → "200ms")
    if (pathStr.startsWith('Semantics.motion')) {
      const m = /^(-?\d+(\.\d+)?)px$/.exec(val.trim());
      return m ? `${m[1]}ms` : val;
    }

    return val;
  });

  // 3) Flatten dos Primitives: expor colors/spacing/sizing no nível raiz
  // Isso permite que tokens referenciem diretamente {colors.blue.500} em vez de {Primitives.colors.blue.500}
  const flat: AnyObj = { ...coerced };
  if (primitives?.Primitives) {
    const { colors, spacing, sizing } = primitives.Primitives;
    if (colors) flat['colors'] = colors;
    if (spacing) flat['spacing'] = spacing;
    if (sizing) flat['sizing'] = sizing;
  }

  // 4) Salvar arquivo merged para o Style Dictionary processar
  writeJson(OUT, flat);
  console.log(`✔ Tokens preparados em ${OUT}`);
}

prepare();
