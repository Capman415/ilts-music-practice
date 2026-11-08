# Christopher’s Music 212 Practice Studio

## Open the actual app

**Music-212-Practice-Studio.html** is the complete app (about 4.1 MB). Save it to your device and open it in a modern browser. It contains the question bank, notation, audio, interface, scoring, and tracking. Nothing else in this folder is required to use it. No account, server, external fonts, scripts, or network is required. A file previewer may show source or a blank page; open the downloaded file in a browser rather than a document previewer.

1. Start a full test, optionally with a 195-minute countdown, or select an objective for practice.
2. Read the tutorial and set a comfortable headphone volume before starting the countdown.
3. The full test hides explanations until submission. Study mode offers Check answer and then locks that item's answer.
4. Submit to see a raw score, subarea/objective breakdown, incorrect-item review, and targeted study suggestions.
5. **Export backup after each session.** Local-file storage varies by browser. Progress is browser-local, not cross-device sync. Import JSON to restore or move progress; import validates structure/version and requires confirmation before replacing data.

All countdowns use elapsed wall-clock time, including time away or with the file closed. Reopening after the deadline submits saved answers. Device-clock changes affect timing. Instructions/headphone test occur before the countdown. Replays, audio seeking, and backward navigation remain enabled: this is **not strict listening-section simulation**.

## Scope and question counts

100 original four-option, single-best-answer items:

| Subarea | Items |
|---|---:|
| Listening skills | 22 |
| Music theory | 17 |
| Creating and performing | 17 |
| History, culture, context | 22 |
| Music education pedagogy | 22 |

Objectives: 0001:8, 0002:5, 0003:3, 0004:2, 0005:4, 0006:4, 0007:4, 0008:5, 0009:4, 0010:4, 0011:4, 0012:4, 0013:5, 0014:5, 0015:5, 0016:4, 0017:4, 0018:4, 0019:5, 0020:4, 0021:4, 0022:4, 0023:5.

Correct positions are balanced at 25 each, deterministically shuffled rather than following an A/B/C/D cycle. Each question includes an explanation and objective tag. Applied classroom/rehearsal scenarios and written music analysis follow the general reasoning style of the official samples, not their exact content.

## Audio and important gaps

17 original 16-kHz, mono, 16-bit PCM WAVs are embedded in the HTML:
- 2 intervals, 2 scales/modes, 2 seventh-chord qualities, 2 cadences after an established tonic.
- 2 meter groupings, syncopation, articulation contrast, crescendo.
- 4 printed-score tasks: wrong pitch, rhythmic error, a +45-cent tuning error, and articulation error. The four-bar intended score is in concert pitch and includes a standard-staff SVG and accessible text description.

**Five text-only listening-domain substitutes:** 0003 has three style/context-description questions; 0004 has two ensemble-description questions. They are prominently marked on the item, tutorial, dashboard, and results. They **do not assess authentic aural style, instrument, voice, or ensemble recognition**. Neutral synthetic tones do not stand in for real instrument timbres, historical styles, world traditions, or live ensemble complexity. Short monophonic error examples are simpler than many realistic performance-error tasks. More authentic licensed recording work is necessary.

## Interpreting scores

- Raw score and percent only; unanswered items count as incorrect. Correct/answered and presented counts are shown separately.
- Per-objective samples are small. “Under 75%” is a study heuristic, not an official standard.
- Aggregated history includes repeated exposure to the same bank, so familiarity can inflate results.
- Original, independent, unofficial practice. Not actual/leaked test items, not endorsed by ILTS, ISBE, or Pearson, and not validated as equivalent difficulty. No official scaled-score conversion or pass prediction.
- Later materials can inform a reviewed version; this version does not automatically ingest additional test content. Its versioned backup schema prevents silently mismatched item banks.

## Source basis

Reviewed supplied local official-framework text and sample-item text plus the derived ITEM_STYLE_GUIDE.md. No new web research or paid practice content was used.
- Framework, January 2017, effective September 2018: https://www.il.nesinc.com/Content/Docs/IL_fld212_FW.pdf
- Official sample directions/items: https://www.il.nesinc.com/Content/STUDYGUIDE/IL_SG_SRI_212.htm

## Build / maintain

Files: build.py (question-authoring and numerical synthesis source), template.html (app interface), core.js (scoring and schema validation), questions.json, audio-manifest.json (explicit notes/timing/tuning), audio/*.wav, tests, and the final standalone HTML.

Requirements to rebuild: Python 3 + NumPy. `python3 build.py` regenerates bank, WAVs, and HTML. A build is deterministic.

Tests:
```
node test-core.js
python3 test_audio.py
# Optional DOM-only integration, no browser automation:
npm install --prefix ../test-tools linkedom
node test-ui.js
```

Checks passed: unique IDs/stems, correct allocations, all 23 objectives, four unique options per item, key/rationale presence, balanced shuffled key positions, schema roundtrip/resume, omissions, history/scoring/weak-area aggregation, invalid-backup rejection, both inline JavaScript programs parsed, and static no-network checks. Every embedded WAV was decoded, compared to its source file, and checked for headers, duration, RMS/nonzero energy, no clipping, and event fundamentals against specified note/tuning data. Reference checks verify scale steps, interval distances, chord qualities, tonic-established cadence notes, meter accents, and error locations.

DOM-only integration passed start/tutorial/countdown, answering/flagging/navigation, storage resume, hidden test explanations, submission/results/review, locked study feedback, timer expiry, reset confirmation, and valid/invalid import. No real browser was available: responsive visual layout, actual speaker playback/codec behavior, file download, and local-file persistence still need a real-browser/device smoke check. Content has not received independent music-educator or psychometric review.
