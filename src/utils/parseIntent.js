import { QUESTIONS } from '../data/questions';

// Very simple local keyword matcher — no backend/API needed.
// Scans free text against every question's options, fills whatever it can.
// Returns { state, answered } partial objects.
export function parseFreeText(text) {
  const lower = text.toLowerCase();
  const state = {};
  const answered = [];

  QUESTIONS.forEach(q => {
    // skip sub-branch questions here; they get asked normally once occasion is known
    if (q.id.startsWith('occasion_detail_')) return;

    const matches = q.options.filter(opt => {
      const optWords = opt.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ');
      return optWords.some(word => word.length > 2 && lower.includes(word));
    });

    if (matches.length === 0) return;

    if (q.type === 'multi') {
      state[q.id] = matches;
      answered.push(q.id);
    } else {
      state[q.id] = matches[0]; // take first/best match for single-select
      answered.push(q.id);
    }
  });

  // a few manual keyword hints not directly tied to option text
  if (/wedding|marriage|bride|shaadi/.test(lower) && !state.occasion) {
    state.occasion = 'Wedding / Reception';
    answered.push('occasion');
  }
  if (/sister|daughter|mom|mother|wife|her /.test(lower) && !state.gender) {
    state.gender = 'Myself (woman)'; // best-effort default, can be corrected later
  }

  return { state, answered };
}