/**
 * Script de preparação dos design tokens
 * 
 * Este script processa os arquivos JSON de tokens (primitives.json e semantics.json)
 * aplicando transformações e correções necessárias antes de serem processados pelo Style Dictionary.
 * 
 * Funcionalidades:
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
 * Função principal de preparação dos tokens
 * Aplica todas as transformações necessárias nos arquivos fonte e gera o arquivo merged
 */
function prepare() {
  // Lê os arquivos fonte de tokens
  const primitives = readJson(path.join(SRC, 'primitives.json'));
  const semanticsBrandsGlobal = readJson(path.join(SRC, 'semantics.json'));

  // 1) Flatten dos Primitives: expor colors/spacing/sizing no nível raiz
  // Isso permite que tokens referenciem diretamente {colors.blue.500} em vez de {Primitives.colors.blue.500}
  const flat: AnyObj = { ...semanticsBrandsGlobal };
  if (primitives?.Primitives) {
    const { colors, spacing, sizing } = primitives.Primitives;
    if (colors) flat['colors'] = colors;
    if (spacing) flat['spacing'] = spacing;
    if (sizing) flat['sizing'] = sizing;
  }

  // 2) Salvar arquivo merged para o Style Dictionary processar
  writeJson(OUT, flat);
  console.log(`✔ Tokens preparados em ${OUT}`);
}

prepare();
