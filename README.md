# The Model Foundry

An animated isometric diagram of how a trillion-parameter language model gets made, drawn as a factory floor: from raw web pages through a hall of GPUs, human feedback and safety testing, to the chat window and back again.

**Live page:** https://nimrodtech.github.io/model-foundry/

Click a station or island for details. Switch between a compact loop and a straight line, isometric and flat drawings, and light and dark. Turn the data, energy, human judgement and hardware flows on and off, and tour by station or by section.

## Host it anywhere

The whole page is one self-contained file: [`docs/index.html`](docs/index.html). It doesn't depend on GitHub Pages, on this repo, or on the address it's served from. The only thing it loads from elsewhere is its fonts, from Google Fonts, and it falls back to system fonts without them.

**As its own page:** upload `docs/index.html` to any static host. You can rename it and put it in any folder.

**Inside another page:** upload it the same way and use an iframe:

```html
<iframe
  src="/model-foundry/index.html"
  title="The Model Foundry: how a trillion-parameter language model is made"
  style="width:100%;height:90vh;border:0"
  loading="lazy"></iframe>
```

The file is about 5.6 MB, so turn on compression at your host if it isn't already on.

Links can open a particular view or station, for example `#line`, `#flat`, `#flat&line` or `#s03`.

## Change it

You need [Node.js](https://nodejs.org/) and nothing else. There are no packages to install.

```bash
node build.mjs
```

This regenerates `docs/index.html`.

| File | What's in it |
|---|---|
| `content.mjs` | All the text and numbers: stations, parties, sections |
| `scene.mjs` | The drawing and layout, built once for each drawing style |
| `runtime.js` | Everything interactive |
| `page.css`, `shell.html` | Styling and the page around the map |
| `build.mjs` | Puts the page together |
| `audit.mjs` | Checks the layout for overlapping text and boundaries: `node audit.mjs` |

`audit.mjs` also lists places where a tall machine might hide a name. That test is rough and gives false alarms, so check those by eye.

## About the numbers

The figures in the panels were written from memory of public papers, model cards and reporting, and haven't each been checked against a source. Some summary rows are rough estimates. Check any figure before you quote it.

## Credits

Drawn with the [Anatomy](https://github.com/wheresryan22/anatomy) isometric kit, MIT licensed. See [`kit/LICENSE-anatomy`](kit/LICENSE-anatomy).
