/**
 * Script de preparação dos design tokens
 * 
 * Este script processa os arquivos JSON de tokens (primitives.json e semantics.json)
 * aplicando transformações e correções necessárias antes de serem processados pelo Style Dictionary.
 * 
 * Funcionalidades:
 * - Expõe Values e Colors dos primitives no nível raiz  
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
  const semantics = readJson(path.join(SRC, 'semantics.json'));

  // Expor Values e Colors dos primitives no nível raiz
  // Isso permite que tokens referenciem diretamente {unit.8} ou {color.brand.orange.500}
  const merged: AnyObj = {
    // Adicionar estruturas de primitives no root
    ...primitives.Values,  // unit, motion, etc
    ...primitives.Colors,  // color
    
    // Adicionar estruturas de semantics
    ...semantics  // Global, Brands, Semantics
  };

  // Copiar estruturas de brand colors de Brands para o nível raiz
  // Isso permite que {color.brand.primary.surface} funcione
  if (merged.Brands?.color?.brand) {
    if (!merged.color) merged.color = {};
    if (!merged.color.brand) merged.color.brand = {};
    
    // Copiar primary, secondary do Brands para color.brand
    ['primary', 'secondary'].forEach(brandKey => {
      if (merged.Brands.color.brand[brandKey]) {
        merged.color.brand[brandKey] = merged.Brands.color.brand[brandKey];
      }
    });

    // Criar accent como entidade separada baseada no primary (padrão)
    if (merged.Brands.color.brand.primary) {
      const primary = merged.Brands.color.brand.primary;
      merged.color.brand.accent = {
        // Usar as propriedades accent existentes como base
        value: primary.accent?.value || primary.darkest?.value,
        type: "other",
        container: primary.container,
        onContainer: primary.onContainer,
        soft: primary.soft,
        surface: primary.surface,
        onSurface: primary.onSurface,
        // Copiar extensões se existirem
        ...(primary.accent?.$extensions && { $extensions: primary.accent.$extensions })
      };
    }
  }

  // Salvar arquivo merged para o Style Dictionary processar
  writeJson(OUT, merged);
  console.log(`✔ Tokens preparados em ${OUT}`);
}

prepare();
