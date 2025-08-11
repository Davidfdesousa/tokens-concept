/**
 * Script de preparação dos design tokens
 * 
 * Este script processa os arquivos JSON de tokens (primitives.json e semantics.json)
 * aplicando transformações e correções necessárias antes de serem processados pelo Style Dictionary.
 * 
 * Funcionalidades:
 * - Expõe Values e Colors dos primitives no nível raiz  
 * - Transforma units de motion.time de px para ms
 * - Gera arquivo merged.tokens.json para o Style Dictionary
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'tokens');
const TMP = path.join(ROOT, '.tmp');
const OUT = path.join(TMP, 'merged.tokens.json');

type AnyObj = Record<string, any>;

// Units usadas pelos tokens motion.time
const MOTION_TIME_UNITS = ['0', '050', '100', '150', '200', '300', '400', '500', '600'];

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
 * Converte valor de unit de px para ms, preservando valores numéricos puros
 */
function convertUnitValue(value: string): string {
  if (typeof value === 'string' && value.endsWith('px')) {
    return value.replace('px', 'ms');
  }
  // Preservar valores numéricos puros (como "0.5")
  return value;
}

/**
 * Cria tokens motionUnit com valores em ms baseados nos tokens unit
 */
function createMotionUnits(merged: AnyObj): AnyObj {
  const motionUnits: AnyObj = {};
  
  for (const unitKey of MOTION_TIME_UNITS) {
    if (merged.unit?.[unitKey]) {
      motionUnits[unitKey] = {
        ...merged.unit[unitKey],
        value: convertUnitValue(merged.unit[unitKey].value)
      };
    }
  }
  
  return { ...merged, motionUnit: motionUnits };
}

/**
 * Atualiza referência de unit para motionUnit se for uma referência válida
 */
function updateUnitReference(value: string): string {
  return value.match(/^\{unit\.\d+\}$/) ? value.replace(/\{unit\./, '{motionUnit.') : value;
}

/**
 * Atualiza referências de motion.time tokens para usar motionUnit
 */
function updateMotionTimeReferences(obj: AnyObj, path: string[] = []): AnyObj {
  const result: AnyObj = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key];
    const isMotionTime = currentPath.join('.').includes('motion.time');
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.value !== undefined && value.type !== undefined && isMotionTime) {
        // É um token motion.time, atualizar suas referências
        const newValue = { ...value };
        
        if (typeof newValue.value === 'string') {
          newValue.value = updateUnitReference(newValue.value);
        }
        
        // Atualizar referências em $extensions.mode se existirem
        if (newValue.$extensions?.mode) {
          for (const [mode, modeValue] of Object.entries(newValue.$extensions.mode)) {
            if (typeof modeValue === 'string') {
              newValue.$extensions.mode[mode] = updateUnitReference(modeValue);
            }
          }
        }
        
        result[key] = newValue;
      } else {
        // Processar recursivamente
        result[key] = updateMotionTimeReferences(value, currentPath);
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Cria estrutura de brand colors no nível raiz para permitir referências
 */
function setupBrandColors(merged: AnyObj): void {
  if (!merged.Brands?.color?.brand) return;
  
  if (!merged.color) merged.color = {};
  if (!merged.color.brand) merged.color.brand = {};
  
  // Copiar primary e secondary do Brands para color.brand
  ['primary', 'secondary'].forEach(brandKey => {
    if (merged.Brands.color.brand[brandKey]) {
      merged.color.brand[brandKey] = merged.Brands.color.brand[brandKey];
    }
  });

  // Criar accent baseado no primary
  if (merged.Brands.color.brand.primary) {
    const primary = merged.Brands.color.brand.primary;
    merged.color.brand.accent = {
      value: primary.accent?.value || primary.darkest?.value,
      type: "other",
      container: primary.container,
      onContainer: primary.onContainer,
      soft: primary.soft,
      surface: primary.surface,
      onSurface: primary.onSurface,
      ...(primary.accent?.$extensions && { $extensions: primary.accent.$extensions })
    };
  }
}

/**
 * Função principal de preparação dos tokens
 */
function prepare() {
  const primitives = readJson(path.join(SRC, 'primitives.json'));
  const semantics = readJson(path.join(SRC, 'semantics.json'));

  // Estrutura base: expor primitives e semantics no nível raiz
  const merged: AnyObj = {
    ...primitives.Values,  // unit, motion, etc
    ...primitives.Colors,  // color
    ...semantics          // Global, Brands, Semantics
  };

  // Configurar estruturas de brand colors
  setupBrandColors(merged);
  
  // Processar motion time tokens
  const withMotionUnits = createMotionUnits(merged);
  const final = updateMotionTimeReferences(withMotionUnits);

  writeJson(OUT, final);
  console.log(`✔ Tokens preparados em ${OUT}`);
}

prepare();
