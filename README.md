# Christopher’s Music 212 Practice Studio — version 2 (300 questions)

## Open the app

Live: https://capman415.github.io/ilts-music-practice/ — or download **Music-212-Practice-Studio.html** (about 12 MB, fully offline: bank, notation, audio, scoring, and tracking are embedded).

## What changed in version 2

- **300 original four-option items** (66 listening · 51 theory · 51 creating/performing · 66 history/context · 66 pedagogy), all 23 objectives.
- The original 100 items (Q001–Q100) keep their IDs, wording, options, and answer keys, so earlier history scores the same.
- **Every full test is a new 100-item form** built to the exam weights (22/17/17/22/22) and a fixed per-objective blueprint. Never-seen questions are chosen first; when an objective’s unseen pool runs out, seen items are drawn with weight 1/(1+times seen)². Listening items come first, grouped by objective; other subareas are shuffled.
- **First-attempt vs. repeat tracking**: each question counts as “first attempt” only the first time it appears in a submitted attempt. The dashboard, results page, and history table show both, overall and by subarea. Use first-attempt accuracy to judge readiness.
- New **25 unseen questions** practice button. Weak-area practice is capped at 30 items and favors unseen questions.
- **Migration**: progress saved by version 1 (same browser storage key) is upgraded automatically on first open; a one-time copy of the original data is kept under `christopher-ilts212-v1-premigration-v1`. Version-1 JSON backups can still be imported.
- Correct-answer positions are balanced at 75 each. New items were revised to reduce “longest option is correct” cues.

## Audio

51 original synthesized clips (16-kHz mono WAV), 34 of them new: intervals (M7 up, m6 down, tritone), melodic sequence, Lydian/whole-tone/octatonic scales, augmented triad, major-7 and fully diminished 7 chords, imperfect authentic/plagal/Phrygian half cadences, canonic (imitative) texture, 9/8, 2/4 and 5/8 meters, hemiola, accelerando, ritardando, diminuendo, terraced dynamics, turn, trill, twelve-bar blues, 7/8 Balkan aksak, 3-2 son clave, and seven new score-following error tasks (pitch ×2, late entrance, flat intonation, dynamics, rushing, staccato). Several timbre profiles are used, but all are neutral synthetic tones.

**Gap:** 15 text substitutes remain under 0003–0004 (7 of 10 in 0003, all 8 in 0004). They do not assess real style, instrument, voice, or ensemble recognition. Use authentic recordings for those objectives.

## Counts per objective

| Objective | Items | Audio | Text substitutes |
|---|---:|---:|---:|
| 0001 | 22 | 22 | 0 |
| 0002 | 15 | 15 | 0 |
| 0003 | 10 | 3 | 7 |
| 0004 | 8 | 0 | 8 |
| 0005 | 11 | 11 | 0 |
| 0006 | 13 | 0 | 0 |
| 0007 | 12 | 0 | 0 |
| 0008 | 14 | 0 | 0 |
| 0009 | 12 | 0 | 0 |
| 0010 | 13 | 0 | 0 |
| 0011 | 12 | 0 | 0 |
| 0012 | 12 | 0 | 0 |
| 0013 | 14 | 0 | 0 |
| 0014 | 15 | 0 | 0 |
| 0015 | 14 | 0 | 0 |
| 0016 | 13 | 0 | 0 |
| 0017 | 12 | 0 | 0 |
| 0018 | 12 | 0 | 0 |
| 0019 | 14 | 0 | 0 |
| 0020 | 13 | 0 | 0 |
| 0021 | 13 | 0 | 0 |
| 0022 | 12 | 0 | 0 |
| 0023 | 14 | 0 | 0 |

## Build and test

Batches are authored in `batches/questions-batch-01.json` … `08.json` (about 25 items each) and checked individually with `python3 validate_batch.py N` (schema, consecutive unique IDs, unique stems, objective plan, four unique options, single key, audio evidence, spectral checks, balanced key positions).

```
python3 build_v2.py      # assembles legacy 100 + batches, synthesizes audio, writes the HTML
node test-core.js        # bank, forms, unseen-first selection, first/repeat split, migration, backups
python3 test_audio.py    # all 51 embedded WAVs decoded and verified against note data
node test-ui.js          # DOM integration incl. v1 migration (needs linkedom in ../test-tools)
```
`build_v1_legacy.py` is the original version-1 generator, kept only for reference (it is the source of objective titles and tips).

## Interpreting scores

Raw percentage only; omissions count as incorrect. Original, unofficial practice, not actual or leaked items, not endorsed by ILTS, ISBE, or Pearson, and not validated for difficulty. No scaled-score conversion or pass prediction. Framework: https://www.il.nesinc.com/Content/Docs/IL_fld212_FW.pdf · Samples: https://www.il.nesinc.com/Content/STUDYGUIDE/IL_SG_SRI_212.htm
