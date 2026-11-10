(() => {
  'use strict';

  const VERSION = '1.0.0';
  const LANES = ['A', 'B'];
  const MINIMUM = 80;
  const NA = 'tidak berlaku';
  const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const norm = value => clean(value).toLocaleLowerCase('id-ID').replace(/\.$/, '');
  const compactSlash = value => norm(value).replace(/\s*\/\s*/g, '/');
  const fingerprint = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/\p{M}|[^\p{L}\p{N}]/gu, '');
  const namePart = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '') || 'Peserta';
  const sameNumber = (a, b) => a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8;

  function fileNameSlug(fullName) {
    const encoder = new TextEncoder();
    let text = '';
    for (const character of namePart(fullName)) {
      if (encoder.encode(text + character).length > 110) break;
      text += character;
    }
    return text.replace(/_+$/, '') || 'Peserta';
  }

  const participantCode = profile => 'K' + profile.id.slice(-10).toUpperCase();

  async function sha256(value) {
    if (!crypto.subtle) throw new Error('Buka paket dari folder lokal atau alamat HTTPS untuk memeriksa identitas berkas.');
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  }

  function answerSpec(field) {
    const choiceUnit = {mt_porsi: 'porsi', vit_jumlah: 'kapsul'}[field.id] || '';
    const unit = (field.label.match(/\(([^()]+)\)\s*$/) || [])[1] || '';
    const choices = (field.options || []).map((label, index) => ({code: 'P' + String(index + 1).padStart(2, '0'), label}));
    const kind = choices.length ? 'choice' : /DD\/MM\/YYYY/i.test(field.label) ? 'date' : /\bmmHg\b/i.test(field.label) ? 'pressure' : /\bHb\b/i.test(field.label) ? 'hb' : field.kind === 'number' ? 'number' : 'text';
    return {kind, choices, unit: kind === 'number' ? unit : choiceUnit, aliases: [...(field.accepted || [])]};
  }

  function noteFor(field) {
    const rule = field.rule;
    if (rule.kind === 'choice') return 'Pilih dari daftar atau ketik satu kode atau nama pilihan lengkap.' + (rule.unit ? ' Angka dengan satuan ' + rule.unit + ' juga diterima jika ada pada pilihan.' : '');
    if (rule.kind === 'date') return 'Tulis tanggal DD/MM/YYYY. Format DD-MM-YYYY atau YYYY-MM-DD juga diterima.';
    if (rule.kind === 'pressure') return 'Tulis sistole/diastole. Satuan mmHg boleh ditambahkan.';
    if (rule.kind === 'hb') return 'Tulis nilai dan satuan g/dL. Anda boleh memakai koma atau titik desimal.';
    if (rule.kind === 'number') return 'Tulis angka. Gunakan koma atau titik desimal.' + (rule.unit ? ' Anda boleh menambahkan satuan ' + rule.unit + '.' : '');
    if (rule.aliases.length) return 'Tulis teks sesuai kasus. Awalan Ibu, Bapak, Anak, atau Posyandu dapat dihilangkan jika awalan itu tercantum pada data kolom ini.';
    return 'Tulis teks sesuai data kasus.';
  }

  function worksheetLabel(field) {
    return [field.label, ...field.rule.choices.map(option => `${option.code} - ${option.label}`), noteFor(field)].join('\n');
  }

  function preparedField(field, index, moduleId, normativeName, criticalIds) {
    const applicable = norm(field.expected) !== NA;
    const rule = answerSpec(field);
    if (rule.kind === 'choice' && !rule.choices.some(o => norm(o.label) === norm(field.expected))) throw new Error('Pilihan jawaban belum lengkap pada ' + field.label + '.');
    const section = field.section === 'pendamping' ? 'Lembar pendamping' : 'Form kartu bantu';
    return {
      ...field,
      required: true,
      applicable,
      critical: criticalIds.has(field.id) || field.workshopCritical === true || (field.id.endsWith('_mentah') && field.critical === true),
      reference: `${section}, baris ${index + 1}, ${normativeName || field.label}`,
      source: `referensi/${moduleId.toLowerCase()}.pdf`,
      rule
    };
  }

  async function makeCase(moduleId, profile, lane, attempt, prior = []) {
    if (!LANES.includes(lane) || !Number.isSafeInteger(attempt) || attempt < 1) throw new Error('Penanda latihan tidak sesuai.');
    const coverage = KADER_CONTENT.curriculumCoverage[moduleId];
    const rubric = WORKSHOP_RUBRIC[moduleId];
    if (!coverage || !rubric) throw new Error('Peta penilaian kartu belum lengkap.');
    const criticalIds = new Set(rubric.critical.map(label => coverage[label]));
    if (criticalIds.has(undefined)) throw new Error('Peta kolom kritis belum lengkap.');
    const names = new Map(Object.entries(coverage).map(([label, id]) => [id, label]));
    const seen = new Set(prior.map(c => c.narrative));
    for (let variant = 0; variant < 25; variant++) {
      const seed = variant ? `${profile.id}-variasi-${variant}` : profile.id;
      const raw = KADER_CONTENT.generateCase(moduleId, seed, attempt, lane);
      if (seen.has(raw.narrative)) continue;
      const fields = raw.fields.map((f, index) => preparedField(f, index, moduleId, names.get(f.id), criticalIds));
      const snapshot = {
        ...raw,
        id: raw.id,
        lane,
        attempt,
        sourceVersion: KADER_CONTENT.version,
        rubricVersion: VERSION,
        fields
      };
      if (!fields.some(f => f.applicable)) throw new Error('Kasus ini belum memiliki kolom yang dapat dinilai.');
      snapshot.digest = await sha256(JSON.stringify(snapshot));
      return snapshot;
    }
    throw new Error('Kasus baru belum tersedia. Coba kembali.');
  }

  function dateCode(value) {
    let m = value.match(/^(\d{1,2})([/\-])(\d{1,2})\2(\d{4})$/);
    let d, month, y;
    if (m) [d, month, y] = [m[1], m[3], m[4]].map(Number);
    else {
      m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      [y, month, d] = m.slice(1).map(Number);
    }
    const date = new Date(0);
    date.setUTCFullYear(y, month - 1, d);
    if (y < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== d) return null;
    return [y, month, d].join('-');
  }

  function numeric(value, unit, requireUnit = false) {
    const m = value.match(/^([+-]?\d+(?:[.,]\d+)?)\s*([\p{L}/][\p{L}/\s]*)?$/u);
    if (!m) return null;
    const actualUnit = (m[2] || '').replace(/\s/g, '');
    const expectedUnit = norm(unit).replace(/\s/g, '');
    if (actualUnit ? actualUnit !== expectedUnit : requireUnit) return null;
    return Number(m[1].replace(',', '.'));
  }

  function pressure(value) {
    const m = value.match(/^(\d+)\s*\/\s*(\d+)(?:\s*mm\s*hg)?$/i);
    return m ? [Number(m[1]), Number(m[2])].join('/') : null;
  }

  function choiceValue(field, answer) {
    const {choices, unit} = field.rule;
    return choices.find(option => {
      const code = norm(option.code);
      const label = norm(option.label);
      if (answer === code || answer === label || answer === `${code} - ${label}` || compactSlash(answer) === compactSlash(label)) return true;
      return unit && /^\d+$/.test(label) && sameNumber(numeric(answer, unit), Number(label));
    })?.label ?? null;
  }

  function match(field, value) {
    const actual = norm(value);
    const expected = norm(field.expected);
    if (!actual) return {correct: false, validChoice: true};
    const {kind, aliases, unit} = field.rule;
    if (kind === 'choice') {
      const label = choiceValue(field, actual);
      return {correct: label !== null && norm(label) === expected, validChoice: label !== null};
    }
    if (actual === expected || aliases.some(alias => norm(alias) === actual)) return {correct: true, validChoice: true};
    if (!field.applicable || expected === NA) return {correct: false, validChoice: true};
    if (kind === 'number') return {correct: sameNumber(numeric(actual, unit), numeric(expected, unit)), validChoice: true};
    if (kind === 'hb') return {correct: sameNumber(numeric(actual, 'g/dL', true), numeric(expected, 'g/dL', true)), validChoice: true};
    if (kind === 'pressure') return {correct: pressure(actual) !== null && pressure(actual) === pressure(expected), validChoice: true};
    if (kind === 'date') return {correct: dateCode(actual) !== null && dateCode(actual) === dateCode(expected), validChoice: true};
    return {correct: false, validChoice: true};
  }

  function grade(caseData, answers) {
    if (caseData.rubricVersion !== VERSION || !caseData.fields.length) throw new Error('Versi penilaian lembar berbeda.');
    const items = caseData.fields.map(field => {
      const answer = clean(answers[field.id]);
      const result = match(field, answer);
      const expectedCode = field.rule.choices.find(option => norm(option.label) === norm(field.expected))?.code || '';
      return {
        id: field.id, label: field.label, answer, expected: field.expected, expectedCode,
        status: result.correct ? 'correct' : answer ? 'wrong' : 'blank',
        invalidChoice: !result.validChoice,
        critical: field.critical, required: field.required, applicable: field.applicable,
        reference: field.reference, source: field.source
      };
    });
    const included = items.filter(i => i.applicable);
    const correct = included.filter(i => i.status === 'correct').length;
    const wrong = included.filter(i => i.status === 'wrong').length;
    const blank = included.filter(i => i.status === 'blank').length;
    const requiredComplete = items.every(i => !i.required || i.status !== 'blank');
    const criticalCorrect = items.every(i => !i.critical || i.status === 'correct');
    const nonApplicableCorrect = items.every(i => i.applicable || i.status === 'correct');
    const total = included.length;
    if (!total) throw new Error('Kasus belum memiliki penyebut nilai.');
    return {
      correct, wrong, blank, total, nonApplicable: items.length - total,
      score: 100 * correct / total, wrongPct: 100 * wrong / total, blankPct: 100 * blank / total,
      requiredComplete, criticalCorrect, nonApplicableCorrect,
      pass: 100 * correct >= MINIMUM * total && requiredComplete && criticalCorrect && nonApplicableCorrect,
      items
    };
  }

  function checkUpload(parsed, filename, caseData, profile) {
    const m = parsed.metadata;
    if (m.participantId !== profile.id || m.moduleId !== caseData.moduleId || m.lane !== caseData.lane || m.caseId !== caseData.id || m.attempt !== caseData.attempt || m.rubricVersion !== caseData.rubricVersion || m.sourceVersion !== caseData.sourceVersion || m.digest !== caseData.digest) throw new Error('Lembar ini tidak cocok dengan peserta, kasus, percobaan, atau versi yang tampil. Unduh DOCX dari kasus ini.');
    const order = [...caseData.fields.filter(f => f.section !== 'pendamping'), ...caseData.fields.filter(f => f.section === 'pendamping')].map(f => f.id);
    if (order.join('|') !== Object.keys(parsed.answers).join('|')) throw new Error('Penanda atau urutan kolom berubah. Unduh lembar baru dan salin jawaban Anda ke lembar itu.');
    if (caseData.fields.some(field => clean(parsed.rowLabels[field.id]) !== clean(worksheetLabel(field)))) throw new Error('Nama kolom atau daftar pilihan berubah. Gunakan lembar dari kasus yang tampil.');
    const instructions = clean([caseData.narrative, ...caseData.questions.map(q => q.text)].join(' '));
    if (clean(parsed.instructions) !== instructions) throw new Error('Isi narasi atau soal berubah. Gunakan lembar yang diunduh dari kasus aktif.');
    const slug = fingerprint(fileNameSlug(profile.fullName));
    if (!fingerprint(filename).includes(slug)) throw new Error('Pertahankan nama peserta yang tercetak pada nama berkas DOCX, lalu unggah kembali.');
  }

  window.KaderWorkshop = Object.freeze({VERSION, LANES, MINIMUM, clean, norm, fileNameSlug, participantCode, sha256, worksheetLabel, makeCase, grade, checkUpload});
})();
