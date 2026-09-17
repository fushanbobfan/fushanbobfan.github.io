# Murmuration

An interactive flocking simulation in the browser, built with plain HTML and vanilla
JavaScript — no build step, no dependencies.

Hundreds of boids follow three local rules — keep apart, line up, stay together — and a
flock emerges. Tune the rules live and watch it tighten into a school, scatter into a swarm,
or ripple away from your cursor.

## Running it

Any static file server works, since the page is loaded as ES modules over HTTP (opening
`index.html` directly via `file://` will not load the modules). For example:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL in a browser.

## Tests

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
