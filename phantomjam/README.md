# phantomjam

An interactive traffic-jam lab in the browser. Cars circle a ring road
following three simple rules, and jams appear out of nowhere: no accident, no
bottleneck, just one driver easing off the accelerator. Watch the jam roll
backwards against the traffic on a space–time diagram, and map the road's
flow–density curve yourself.

**Live demo:** https://fushanbobfan.github.io/phantomjam/

Runs with no build step and no dependencies. The traffic model, presets and
drawing geometry are plain ES modules covered by a Node test suite; only the
page glue touches the DOM.

## Quick start

Open `index.html` in a browser, or serve the folder:

```bash
npm run serve
# then visit http://localhost:8080
```

The dev server is a ~40-line dependency-free static file server; any other
static server works too.
