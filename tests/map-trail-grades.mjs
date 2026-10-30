import assert from 'node:assert/strict';
import {auditTrackRises} from '../scripts/audit_track_rises.mjs';
const report=auditTrackRises();assert.ok(report.roads>16000&&report.streetSamples>500000,'Audit covers the full merged game map');assert.ok(report.maximumTrackLift<1e-7,'Bush trails must not lift any street sample');assert.equal(report.findings.length,0);console.log(`PASS: ${report.streetSamples} street samples across ${report.roads} mapped road/path ways have no bush-trail-induced lift; structural paths and rail clearances are retained.`);
