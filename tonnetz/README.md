# tonnetz

A map of harmony in the browser. Notes a fifth apart run left to right, major
thirds climb to the right and minor thirds to the left, so every triangle on
the lattice is a triad: pointing up, major; pointing down, minor. Chords that
share an edge share two notes. Click a triangle to hear it, press P, L or R to
flip across one of its edges, or type a progression and watch the path it
takes, one voice moving at a time.

**Live demo:** https://fushanbobfan.github.io/tonnetz/

No build step and no dependencies. The music theory, the lattice geometry, the
playback timeline, the view maths, the drawing code and the share-link format
are plain ES modules covered by a Node test suite; only `src/main.js` and
`src/audio.js` touch the browser.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later).

## The three moves

Neo-Riemannian theory describes chord changes by three operations. Each keeps
two notes of a triad, moves the third by a semitone or a whole tone, and swaps
major for minor. On the lattice each one is a flip across one edge of the
triangle.

| Move | Name | C major goes to | What moves |
| --- | --- | --- | --- |
| P | Parallel | C minor | E falls a semitone to E♭ |
| L | Leading-tone exchange | E minor | C falls a semitone to B |
| R | Relative | A minor | G rises a whole tone to A |

All three undo themselves (PP, LL and RR are no change), and together they
reach all 24 major and minor triads. Repeating a pair of moves walks a cycle:
PL gives the six-chord hexatonic cycle C, Cm, A♭, A♭m, E, Em; PR the
eight-chord octatonic cycle C, Cm, E♭, E♭m, F♯, F♯m, A, Am; and LR runs
through all 24 triads. The tests check each of these.

## Progressions as paths

Type chords as symbols (`C`, `Am`, `F#`, `Bbm`, `E♭`, `Dmin`; a lowercase root
with no suffix is read as minor, as in Riemann's notation). Separate them with
spaces, commas or bars. Each change is replaced by its shortest word in P, L
and R, found by breadth-first search over the 24 triads, and the word is
walked triangle by triangle from wherever the previous chord sat, so the path
never jumps. The farthest any two triads lie apart is five moves.

Some familiar progressions turn out short and some long. The falling-thirds
chain C, Am, F, Dm, B♭ … alternates R and L, one move per chord, and drifts
steadily across the lattice. The four-chord pop loop C, G, Am, F needs eight
moves, three of them for the step from G to Am, because V and vi share no
notes.

Playback gives each chord two beats. Triangles passed through on the way are
lit during the first beat, and each chord is voiced from the one before by
moving every voice as little as possible, so a single move changes a single
note.

## Held notes

Shift-click circles, or type note names into the held-notes box, to build any
set of up to twelve notes. The panel names it: a triad of any quality
(major, minor, diminished, augmented, suspended), a seventh chord (major,
dominant, minor, half-diminished, diminished, minor-major, augmented major),
an interval, or a plain list when nothing fits. Symmetric chords list every
root they could have, starting from the first note held, which is also the
bass when the set is played.

Any major or minor triad inside the set lights up on the lattice. That shows
which seventh chords live there: a major seventh is a major triad and the
minor triad that shares its upper edge (Cmaj7 = C + Em), and a minor seventh
is a minor triad and its relative major (Am7 = Am + C). Both sit as two
triangles side by side. A dominant seventh fills only one triangle, because
its upper three notes form a diminished triad, which has no triangle of its
own. The held notes travel in the share link.

The piano strip under the lattice does the same from the keyboard side:
pressing a key holds or releases its note, every octave of a held note is
marked, and the keys that are sounding light up as chords play. The strip is
a row of real buttons, so it works without a pointer: Tab reaches it, the
arrow keys, Home and End move along it, and Enter or Space presses a key.

## Controls

| Input | Action |
| --- | --- |
| Click a triangle | Play its chord and make it current |
| Click a circle | Play that note |
| Shift-click a circle | Add or remove a held note |
| Piano key (click, or Enter on a focused key) | Add or remove a held note |
| P, L, R (keys or buttons) | Move the current chord across an edge |
| Backspace / Step back | Return to the previous chord |
| Space / Play | Play or stop the progression |
| Drag, arrow keys | Move the lattice |
| Scroll, pinch, + and − | Zoom |
| F / ⤢ | Fit the path in view |

Spelling can follow the usual lead-sheet choice (B♭, E♭, F♯), all flats or
all sharps. Chord notes are spelled on consecutive letters, so A♭ major is
A♭ C E♭ and F♯ major is F♯ A♯ C♯. A typed root keeps its spelling. The share
button writes the progression, tempo, spelling, labels, current chord and held
notes into the link.

## Code layout

| File | Contents |
| --- | --- |
| `src/pitch.js` | Pitch classes, note parsing and spelling, MIDI and frequency |
| `src/chords.js` | The 24 triads, chord symbols, progression parsing, triad recognition |
| `src/plr.js` | P, L and R, shortest words, cycles, the moving voice, voice leading |
| `src/lattice.js` | Lattice coordinates, triangles, neighbours, hit testing |
| `src/chordset.js` | Naming held note sets: extended triads, sevenths, intervals |
| `src/keyboard.js` | Piano strip layout |
| `src/progression.js` | Presets and tracing a progression as a lattice path |
| `src/player.js` | Playback timeline and voicings |
| `src/view.js` | Pan, zoom and fitting |
| `src/render.js` | Canvas drawing |
| `src/settings.js` | Share-link encoding |
| `src/audio.js` | Web Audio synth |
| `src/main.js` | Page wiring |

## Background

The lattice goes back to Euler's *Tentamen novae theoriae musicae* (1739). It
was taken up by Hugo Riemann, and in the 1980s and 1990s David Lewin and
Richard Cohn built the transformational theory that the P, L and R moves come
from.

## Licence

MIT
