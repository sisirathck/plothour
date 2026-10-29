import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReportLetter, reportLetterCopy, styleReportContent } from '../reportEmailDesign.js';

test('every report uses the shared letter, absolute action links and preferences', () => {
  for (const type of Object.keys(reportLetterCopy)) {
    const html = renderReportLetter({ type, baseUrl: 'https://example.com', metric: '8h 42m', name: 'Alex', content: '<h2>Projects</h2><table><tr><td>Algorithms</td></tr></table>' });
    assert.ok(html.includes('https://example.com/plothour-logo-light.png'));
    assert.ok(html.includes('https://example.com/manage?tab=email'));
    assert.ok(html.includes(reportLetterCopy[type][1]));
    assert.ok(html.includes('Algorithms'));
    assert.ok(html.includes('8h 42m'));
    assert.ok(html.includes('Manage email reports in PlotHour.'));
    assert.ok(!html.includes('display:flex'));
  }
});
test('dynamic letter fields are escaped and progress is bounded', () => {
  const html = renderReportLetter({ type: 'weekly-recap', name: '<img src=x>', date: '<script>', metric: '<bad>', context: 'A & B', progress: 150 });
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;bad&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.ok(html.includes('width="100%" style="height:3px'));
});
test('report tables retain alignment and complete data without colored boxes', () => {
  const html = styleReportContent('<section style="background:red"><table><tr><td align="right" style="color:green">12h</td></tr></table></section>');
  assert.ok(html.includes('align="right"'));
  assert.ok(html.includes('12h'));
  assert.ok(html.includes('border-bottom:1px solid #eeedf2'));
  assert.ok(!html.includes('background:red'));
});
test('recipient unsubscribe replacement remains available for reports and reminders', () => {
  for (const footer of ['Manage email reports in PlotHour.', 'Manage your task reminders in PlotHour.']) {
    const html = renderReportLetter({ type: 'task-reminder', footer }).replace(footer, '<a href="https://example.com/unsubscribe">Unsubscribe</a>');
    assert.ok(html.includes('href="https://example.com/unsubscribe"'));
  }
});
