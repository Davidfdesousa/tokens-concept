## No Figma

Você trabalha com 5 *collections* de Variáveis para ter máxima flexibilidade e clareza de responsabilidades:

- **primitives** – valores brutos (cores, espaçamentos, raios…)
- **globals** – paletas completas de cada marca (Nature, Tech, Creative, Jupiter)
- **brand** – “wrapper” que mapeia a marca ativa (modes: nature, tech, creative, jupiter)
- **semantics** – papéis visuais que mudam por tema (modes: light, dark, contrast)
- **component-tokens** – ligação final de cada componente aos tokens semânticos

---

## No JSON/Código

Juntamos **globals + brand** em um único arquivo (`brand.json`), porque no front-end só precisamos do objeto de marca ativa.  
Assim, sobramos com 4 arquivos JSON, respeitando a hierarquia:

```text
primitives → brand (globals + brand) → semantics → components
```

## Arquivos JSON

### 1. primitives.json
---
Valores brutos — cores neutras e de apoio, espaçamentos, raios.
```
{
  "color": {
    "neutral-0": "#FFFFFF",
    "neutral-100": "#F5F5F5",
    "neutral-200": "#EEEEEE",
    "neutral-900": "#1A1A1A",
    "green-500": "#2E7D32",
    "green-600": "#1B5E20",
    "blue-500": "#1976D2",
    "blue-600": "#0D47A1",
    "pink-500": "#D81B60",
    "pink-600": "#AD1457",
    "purple-500": "#8E24AA",
    "purple-600": "#6A1B9A",
    "violet-500": "#BA68C8",
    "yellow-500": "#FFB300"
  },
  "spacing": {
    "1": "4px",
    "2": "8px"
  },
  "radius": {
    "lg": "9999px"
  }
}
```


### 2. brand.json
---

Aqui unimos globals e brand: contém todas as paletas de marca e será filtrado pela activeBrand em runtime.
```
{
  "nature": {
    "primary": "{primitives.color.green-500}",
    "primary-dark": "{primitives.color.green-600}",
    "accent": "{primitives.color.yellow-500}"
  },
  "tech": {
    "primary": "{primitives.color.blue-500}",
    "primary-dark": "{primitives.color.blue-600}",
    "accent": "{primitives.color.blue-500}"
  },
  "creative": {
    "primary": "{primitives.color.pink-500}",
    "primary-dark": "{primitives.color.pink-600}",
    "accent": "{primitives.color.yellow-500}"
  },
  "jupter": {
    "primary": "{primitives.color.violet-500}",
    "primary-dark": "{primitives.color.violet-600}",
    "accent": "{primitives.color.violet-500}"
  }
}
```


### 3. semantics.json
---

Papéis visuais que mudam conforme o tema (light/dark/contrast). Usa a cor da marca ativa via {brand.{activeBrand}.*}.
```
{
  "light": {
    "background-default": "{primitives.color.neutral-0}",
    "text-body":          "{primitives.color.neutral-900}",
    "text-highlight":     "{brand.{activeBrand}.primary}",
    "text-link":          "{brand.{activeBrand}.primary}"
  },
  "dark": {
    "background-default": "{primitives.color.neutral-900}",
    "text-body":          "{primitives.color.neutral-200}",
    "text-highlight":     "{brand.{activeBrand}.primary}",
    "text-link":          "{brand.{activeBrand}.primary}"
  },
  "contrast": {
    "background-default": "{primitives.color.yellow-500}",
    "text-body":          "{primitives.color.white}",
    "text-highlight":     "{brand.{activeBrand}.accent}",
    "text-link":          "{brand.{activeBrand}.accent}"
  }
}
```


### 4. components.json
---

Component tokens — sempre apontam para semantics e brand já filtrado.
```
{
  "button": {
    "bg":       "{semantics.{activeTheme}.background-default}",
    "text":     "{semantics.{activeTheme}.text-highlight}",
    "border":   "1px solid {semantics.{activeTheme}.background-default}",
    "hover-bg": "{brand.{activeBrand}.primary-dark}"
  },
  "card": {
    "bg":     "{semantics.{activeTheme}.background-default}",
    "text":   "{semantics.{activeTheme}.text-body}",
    "border": "1px solid {semantics.{activeTheme}.background-default}"
  },
  "link": {
    "text": "{semantics.{activeTheme}.text-link}"
  }
}
```

### Dessa forma, mantemos 5 collections no Figma para máxima clareza, mas no front-end consumimos apenas 4 arquivos JSON, com globals e brand unidos em brand.json.

Figma - https://www.figma.com/design/xQyQGMGEBvCiFIMe8pyOgU/DDS?node-id=2-13&t=KQPO3H9etlYu79qh-1
