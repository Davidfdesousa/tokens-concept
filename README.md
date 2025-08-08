# Design Tokens Concept

Sistema automatizado de design tokens que gera tokens CSS e SCSS para múltiplas marcas e temas de forma dinâmica.

## Visão Geral

Este projeto implementa um pipeline de build que processa tokens de design em JSON e gera arquivos CSS/SCSS prontos para produção. O sistema é completamente dinâmico, detectando automaticamente marcas e temas a partir da estrutura dos arquivos JSON.

## Arquitetura

### Estrutura de Tokens

O sistema utiliza uma hierarquia de 3 níveis:

```
Primitives → Brands → Semantics
```

- **Primitives**: Valores base (cores, espaçamentos, tipografia)
- **Brands**: Variações por marca (marca1, marca2, marca3...)
- **Semantics**: Papéis visuais que variam por tema (light, dark...)

### Arquivos de Entrada

#### `src/tokens/primitives.json`
Contém valores fundamentais do design system:

```json
{
  "colors": {
    "blue": {
      "500": { "value": "#1976D2", "type": "color" }
    },
    "green": {
      "500": { "value": "#2E7D32", "type": "color" }
    }
  },
  "spacing": {
    "4": { "value": "16px", "type": "dimension" }
  }
}
```

#### `src/tokens/semantics.json`
Define tokens semânticos com variações por marca e tema:

```json
{
  "color": {
    "text": {
      "body": {
        "value": "{colors.neutral.900}",
        "type": "color",
        "$extensions": {
          "mode": {
            "light": "{colors.neutral.900}",
            "dark": "{colors.neutral.100}"
          }
        }
      }
    }
  },
  "action": {
    "primary": {
      "base": {
        "value": "{colors.blue.500}",
        "type": "color",
        "$extensions": {
          "mode": {
            "marca1": "{colors.blue.500}",
            "marca2": "{colors.green.500}",
            "marca3": "{colors.red.500}"
          }
        }
      }
    }
  }
}
```

### Detecção Automática

O sistema analisa a estrutura `$extensions.mode` para descobrir automaticamente:
- **Marcas**: Encontradas nos tokens de marca (seção `Brands`)
- **Temas**: Encontrados nos tokens semânticos (seção `Semantics`)

**O projeto é completamente agnóstico e escalável**: você pode adicionar quantas marcas e temas quiser nos arquivos JSON, e o sistema detectará e gerará os arquivos automaticamente sem necessidade de alterações no código.

## Scripts de Build

### 1. Preparação (`scripts/prepare-tokens.ts`)
- Aplana a estrutura de primitives
- Mescla primitives e semantics
- Gera arquivo temporário `merged.tokens.json`

### 2. Geração (`style-dictionary/build.ts`)
- Descobre marcas e temas automaticamente
- Configura Style Dictionary dinamicamente
- Gera arquivos CSS/SCSS para cada combinação marca/formato

## Comandos Disponíveis

```bash
# Instalar dependências
npm install

# Gerar tokens (preparação + build)
npm run build

# Limpar arquivos gerados
npm run tokens:clean

# Apenas preparar (sem gerar CSS/SCSS)
npm run tokens:prepare

# Modo watch (regenera quando JSONs mudam)
npm run tokens:watch

# Servidor de desenvolvimento
npm run dev
```

## Saída Gerada

O build gera arquivos organizados por marca:

```
dist/tokens/
├── marca1/
│   ├── css/tokens.css
│   └── scss/tokens.scss
├── marca2/
│   ├── css/tokens.css
│   └── scss/tokens.scss
└── marca3/
    ├── css/tokens.css
    └── scss/tokens.scss
```

### Formato CSS
Inclui todos os temas com seletores CSS:

```css
:root,
:root[data-color-scheme="light"] {
  --dds_color_text_body: #1a1a1a;
  --dds_action_primary_base: #1976d2;
}

:root[data-color-scheme="dark"] {
  --dds_color_text_body: #f5f5f5;
}
```

### Formato SCSS
Apenas tema padrão (light) como variáveis:

```scss
$dds_color_text_body: #1a1a1a;
$dds_action_primary_base: #1976d2;
```

## Tecnologias

- **Node.js**: Runtime de execução
- **TypeScript**: Linguagem principal
- **Style Dictionary**: Engine de transformação de tokens
- **Vite**: Bundler e servidor de desenvolvimento

## Funcionalidades

### Dinâmico e Escalável
- Detecta marcas e temas automaticamente do JSON
- **Completamente agnóstico**: Funciona com qualquer nome de marca ou tema
- **Infinitamente escalável**: Adicionar novas marcas/temas não requer alterações no código
- Pipeline de build completamente baseado nos dados dos arquivos JSON

### Resolução de Referências
- Suporte completo a referências entre tokens (`{path.to.token}`)
- Detecção de referências circulares
- Resolução recursiva de valores

### Múltiplos Formatos
- CSS com custom properties e seletores de tema
- SCSS com variáveis estáticas
- Nomenclatura consistente (snake_case com prefixo `dds_`)

### Otimizado para Performance
- Código TypeScript moderno e eficiente
- Funções utilitárias reutilizáveis
- Build rápido e incremental

## Estrutura do Projeto

```
├── src/
│   └── tokens/           # Arquivos JSON de entrada
├── scripts/              # Scripts de preparação
├── style-dictionary/     # Configuração do Style Dictionary
├── dist/                 # Arquivos gerados
├── .tmp/                 # Arquivos temporários
└── public/              # Assets estáticos
```

## Desenvolvimento

### Adicionando Novas Marcas

Para adicionar uma nova marca, basta incluir os valores na seção `$extensions.mode` dos tokens de marca. Exemplo:

```json
{
  "action": {
    "primary": {
      "base": {
        "$extensions": {
          "mode": {
            "marca1": "{colors.blue.500}",
            "marca2": "{colors.green.500}",
            "novaMarca": "{colors.purple.500}"
          }
        }
      }
    }
  }
}
```

### Adicionando Novos Temas

Para adicionar um novo tema, inclua os valores na seção `$extensions.mode` dos tokens semânticos. Exemplo:

```json
{
  "color": {
    "text": {
      "body": {
        "$extensions": {
          "mode": {
            "light": "{colors.neutral.900}",
            "dark": "{colors.neutral.100}",
            "novoTema": "{colors.neutral.500}"
          }
        }
      }
    }
  }
}
```

**O sistema detectará automaticamente** as novas marcas e temas, gerando os arquivos correspondentes sem necessidade de alterações no código.

---

**Link do Figma**: [Design System](https://www.figma.com/design/xQyQGMGEBvCiFIMe8pyOgU/DDS?node-id=2-13&t=KQPO3H9etlYu79qh-1)
