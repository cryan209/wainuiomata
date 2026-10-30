# Bush-track elevation audit — 30 October 2026

Checked 16,613 merged road/path ways and 532,274 non-bridge street-profile samples using the packaged terrain grids, the game's grid blends, rail ground shaping and rail clearances.

The counterfactual removes free-standing bush trails while retaining mapped bridges, underpass paths and shared sidewalks. This preserves structural clearance requirements rather than mistaking them for a grading defect.

The old shared grade graph lifted **80 road ways by more than 1 metre**. Several ways may belong to one street. The revised street-first solver removes bush-trail grading from street elevations; the maximum remaining difference is below 0.0000001m (floating-point rounding). This checks the cause of the rise, not general survey accuracy or every possible road-elevation issue.

| Named street | Largest track-induced rise removed |
| --- | ---: |
| Mawson Street | 59.86m |
| Waddington Drive | 45.92m |
| Prouse Crescent | 45.20m |
| Hay Street | 40.59m |
| Stokes Valley Road | 34.70m |
| Whites Line East | 32.01m |
| Wainuiomata Hill Road | 29.26m |
| Kereru Grove | 18.85m |
| Delaney Drive | 15.05m |
| Hayward Terrace | 11.14m |
| Shackleton Grove | 9.92m |
| Puriri Street | 9.73m |
| Karaka Bay Road | 8.58m |
| Major Drive | 8.50m |
| Massey Road | 7.85m |
| Rakau Grove | 7.43m |
| Totara Road | 7.41m |
| Akepiro Grove | 6.75m |
| Hill Road | 6.54m |
| Darlington Road | 5.42m |
| Pohutukawa Street | 5.24m |
| Massey Avenue | 4.57m |
| Camperdown Road | 4.12m |
| Fraser Street | 4.04m |
| North Street | 3.97m |
| Gaskill Grove | 3.82m |
| Middleton Road | 3.35m |
| Main Road | 3.19m |
| MacKenzie Road | 2.87m |
| Muritai Road | 2.87m |
| Park Road | 2.86m |
| Tama Street | 2.79m |
| Hebden Crescent | 2.31m |
| Moores Valley Road | 2.09m |
| Marine Drive | 1.78m |
| Jamaica Drive | 1.50m |
| Victoria Street | 1.33m |
| Marsden Street | 1.33m |
| George Street | 1.08m |

Unnamed service roads and links are also included in the count. The paired JSON report preserves affected way IDs and model coordinates.

Re-run `node scripts/audit_track_rises.mjs` or `node tests/map-trail-grades.mjs`. Synthetic regressions in `tests/trail-grade-isolation.mjs` check that tracks, paths, footways, cycleways, bridleways and steps retain their hill elevations and join fixed street endpoints without lifting the street.
