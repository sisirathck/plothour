import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSessions, summarizeProfile, goalSecondsForRange, studyDateKey } from '../../shared/studyMetrics.js';
test('90-day totals include all active days rather than truncating to 60',()=>{
 const entries=Array.from({length:90},(_,day)=>({startedAt:Date.UTC(2026,0,1+day),durationSeconds:3600}));const stats=summarizeSessions(entries,'UTC');assert.equal(stats.activeDays,90);assert.equal(stats.seconds,324000);assert.equal(stats.longestStreak,90);assert.equal(stats.averageActiveDaySeconds,3600);
});
test('zero goals stay unset and explicit goals are shared across profile summaries',()=>{
 assert.equal(goalSecondsForRange([],'today'),0);const projects=[{subjects:[{goals:{daily:1,weekly:5,monthly:20}}]}];assert.equal(goalSecondsForRange(projects,'week'),18000);assert.equal(goalSecondsForRange(projects,'90days',90),324000);assert.equal(goalSecondsForRange(projects,'all'),0);
});
test('saved sessions consistently belong to their start day in the chosen timezone',()=>{
 const date=Date.parse('2026-10-29T20:00:00Z');assert.equal(studyDateKey(date,'Asia/Kolkata'),'2026-10-30');assert.equal(studyDateKey(date,'UTC'),'2026-10-29');
});
test('profile metrics and basic session totals agree',()=>{
 const entries=[{startedAt:Date.UTC(2026,0,1),durationSeconds:3600},{startedAt:Date.UTC(2026,0,1,2),durationSeconds:1800}];const base=summarizeSessions(entries,'UTC');const profile=summarizeProfile({entries,timeZone:'UTC',start:Date.UTC(2026,0,1),end:Date.UTC(2026,0,2),calendarDays:2,projects:[],range:'custom'});assert.equal(profile.current.seconds,base.seconds);assert.equal(profile.current.activeDays,base.activeDays);assert.equal(profile.current.averageSessionSeconds,base.averageSessionSeconds);assert.equal(profile.current.goalDays,0);
});
