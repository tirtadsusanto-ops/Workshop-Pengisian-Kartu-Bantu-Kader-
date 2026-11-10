(function () {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const CP = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
  const VERSION = 'KADER-WORKSHOP-DOCX-1';
  const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const PLACEHOLDER = '[Ketik jawaban di sini]';
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const name = p => p.fullName || p.fullname || p.name || 'Peserta';
  const pid = p => String(p.id || p.participantId || '');
  const text = v => v === true ? 'Benar' : v === false ? 'Salah' : v == null || String(v).trim() === '' ? 'Belum dijawab' : String(v);
  const pXml = (value, bold, style) => '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + '<w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' + (bold ? '<w:b/>' : '') + '<w:sz w:val="24"/></w:rPr>' + String(value).split('\n').map((s, i) => (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(s) + '</w:t>').join('') + '</w:r></w:p>';
  const cell = (value, width, bold) => '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/></w:tcPr>' + pXml(value, bold) + '</w:tc>';
  const validId = v => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,90}$/.test(v);
  function assertCase(c, profile) {
    if (!window.JSZip) throw new Error('Pustaka berkas belum tersedia. Buka kembali aplikasi dari folder lengkap.');
    if (!c || !c.id || !c.moduleId || !Array.isArray(c.fields) || !c.fields.length || c.fields.length > 200 || !pid(profile)) throw new Error('Data lembar belum lengkap.');
    const ids = c.fields.map(f => f.id);
    if (ids.some(id => !validId(id)) || new Set(ids).size !== ids.length) throw new Error('Penanda kolom kasus tidak sesuai.');
  }
  async function createWorksheet(c, profile) {
    assertCase(c, profile);
    const metadata = { participantId: pid(profile), moduleId: c.moduleId, caseId: c.id, lane: c.lane, attempt: c.attempt, version: VERSION, sourceVersion: c.sourceVersion, rubricVersion: c.rubricVersion, digest: c.digest, fieldIds: c.fields.map(f => f.id) };
    const z = new JSZip();
    const types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>';
    z.file('[Content_Types].xml', types);
    z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>');
    z.file('docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + esc(c.title) + '</dc:title><dc:creator>Workshop Pengisian Kartu Bantu Kader</dc:creator></cp:coreProperties>');
    z.file('docProps/custom.xml', '<?xml version="1.0"?><Properties xmlns="' + CP + '" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="KADER_META"><vt:lpwstr>' + esc(JSON.stringify(metadata)) + '</vt:lpwstr></property></Properties>');
    z.file('word/styles.xml', '<?xml version="1.0"?><w:styles xmlns:w="' + W + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/></w:rPr></w:style></w:styles>');
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
    z.file('word/footer1.xml', '<?xml version="1.0"?><w:ftr xmlns:w="' + W + '"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">Halaman </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>');
    const locked = (tag, id, content) => '<w:sdt><w:sdtPr><w:lock w:val="sdtContentLocked"/><w:id w:val="' + id + '"/><w:tag w:val="' + tag + '"/></w:sdtPr><w:sdtContent>' + content + '</w:sdtContent></w:sdt>';
    let body = pXml('LEMBAR TUGAS WORKSHOP', true, 'Heading1') + pXml(c.title, true) + pXml('Nama peserta ' + name(profile));
    body += locked('KADER-IDENTITAS', 700, pXml('Kode peserta ' + pid(profile) + ' | Modul ' + c.moduleId + ' | Kasus ' + c.lane + ' | Percobaan ' + c.attempt + '\nKode lembar ' + c.id + ' | Versi rubrik ' + c.rubricVersion + ' | Versi sumber ' + c.sourceVersion));
    body += pXml('Kasus simulasi', true, 'Heading1') + locked('KADER-NARASI', 701, pXml(c.narrative));
    body += pXml('Pertanyaan penerapan', true, 'Heading1');
    c.questions.forEach((q, i) => { body += locked('KADER-SOAL-' + (i + 1), 702 + i, pXml(q.text)); });
    body += pXml('Form kartu bantu', true, 'Heading1') + pXml('Isi setiap kolom Jawaban peserta. Pada pilihan, gunakan menu jika tersedia atau ketik satu kode yang tercetak. Pada isian teks, ganti tulisan [Ketik jawaban di sini]. Pertahankan tabel dan penanda kolom. Simpan sebagai DOCX dengan nama berkas yang disediakan aplikasi.');
    const formTable = entries => {
      let rows = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + cell('No.', 800, true) + cell('Kolom kartu bantu', 3500, true) + cell('Jawaban peserta', 4700, true) + '</w:tr>';
      entries.forEach(({f, i}) => {
        const choices = f.rule.choices;
        const label = KaderWorkshop.worksheetLabel(f);
        const item = (display, value) => '<w:listItem w:displayText="' + esc(display) + '" w:value="' + esc(value) + '"/>';
        const control = choices.length ? '<w:dropDownList>' + item(PLACEHOLDER, '') + choices.map(o => item(o.code + ' - ' + o.label, o.code)).join('') + '</w:dropDownList>' : '<w:text/>';
        const answer = '<w:tc><w:tcPr><w:tcW w:w="4700" w:type="dxa"/></w:tcPr><w:sdt><w:sdtPr><w:alias w:val="' + esc(f.label) + '"/><w:lock w:val="sdtLocked"/><w:id w:val="' + (i + 1000) + '"/><w:tag w:val="KADER|' + esc(f.id) + '"/>' + control + '</w:sdtPr><w:sdtContent>' + pXml(PLACEHOLDER) + '</w:sdtContent></w:sdt></w:tc>';
        const labelCell = '<w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/></w:tcPr>' + locked('KADER-ROW|' + f.id, i + 2000, pXml(label)) + '</w:tc>';
        rows += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + cell(String(i + 1), 800) + labelCell + answer + '</w:tr>';
      });
      return '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => '<w:' + k + ' w:val="single" w:sz="4" w:color="999999"/>').join('') + '</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="800"/><w:gridCol w:w="3500"/><w:gridCol w:w="4700"/></w:tblGrid>' + rows + '</w:tbl>';
    };
    const entries = c.fields.map((f, i) => ({f, i}));
    const primary = entries.filter(e => e.f.section !== 'pendamping');
    const companion = entries.filter(e => e.f.section === 'pendamping');
    if (primary.length) body += formTable(primary);
    if (companion.length) body += pXml('Lembar pendamping', true, 'Heading1') + pXml('Isi keterangan tambahan berikut dengan data kasus pada kolom Jawaban peserta.') + formTable(companion);
    body += pXml('Catatan bebas tidak dinilai', true, 'Heading1') + pXml('');
    body += '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="600" w:footer="600"/></w:sectPr>';
    z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + W + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + body + '</w:body></w:document>');
    return z.generateAsync({ type: 'blob', mimeType: MIME_DOCX, compression: 'DEFLATE' });
  }
  function parseXml(s, label) {
    if (s.length > 6 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(s)) throw new Error(label + ' tidak dapat dibaca.');
    const d = new DOMParser().parseFromString(s, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw new Error(label + ' rusak.');
    return d;
  }
  function ancestorDeleted(e) {
    for (let p = e.parentElement; p; p = p.parentElement) {
      if (p.namespaceURI === W && ['del', 'moveFrom'].includes(p.localName)) return true;
      if (p.namespaceURI === W && p.localName === 'sdtContent') return false;
    }
    return false;
  }
  const children = (element, name) => Array.from(element?.children || []).filter(child => child.namespaceURI === W && child.localName === name);
  const tagged = control => children(children(control, 'sdtPr')[0], 'tag')[0]?.getAttributeNS(W, 'val') || '';

  function nearest(element, name) {
    for (let current = element; current; current = current.parentElement) {
      if (current.namespaceURI === W && current.localName === name) return current;
    }
    return null;
  }

  function readText(element) {
    if (!element) throw new Error('Isi kolom lembar tidak lengkap.');
    let value = '';
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const e = walker.currentNode;
      if (e.namespaceURI !== W || ancestorDeleted(e)) continue;
      if ((e.localName === 'p' && value) || e.localName === 'br' || e.localName === 'tab') value += ' ';
      if (e.localName === 't') value += e.textContent;
    }
    return value.replace(/\u00a0/g, ' ').trim();
  }
  async function readWorksheet(file) {
    if (!window.JSZip) throw new Error('Pustaka berkas belum tersedia.');
    if (!file || !/\.docx$/i.test(file.name || '')) throw new Error('Pilih berkas dengan akhiran .docx.');
    if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new Error('Ukuran DOCX harus lebih dari nol dan tidak melebihi 8 MB.');
    let z;
    try { z = await JSZip.loadAsync(await file.arrayBuffer()); } catch (_) { throw new Error('DOCX tidak dapat dibuka. Gunakan berkas utuh tanpa kata sandi.'); }
    const entries = Object.values(z.files);
    if (entries.length > 250 || entries.reduce((n, f) => n + (f._data && f._data.uncompressedSize || 0), 0) > 32 * 1024 * 1024) throw new Error('Isi DOCX terlalu besar untuk diperiksa.');
    if (!z.file('word/document.xml') || !z.file('docProps/custom.xml')) throw new Error('Berkas ini bukan lembar tugas yang diunduh dari aplikasi.');
    const props = parseXml(await z.file('docProps/custom.xml').async('string'), 'Identitas lembar');
    const matches = Array.from(props.getElementsByTagNameNS(CP, 'property')).filter(e => e.getAttribute('name') === 'KADER_META');
    if (matches.length !== 1) throw new Error('Identitas lembar tidak lengkap atau ganda. Unduh lembar baru.');
    let meta;
    try { meta = JSON.parse(matches[0].textContent); } catch (_) { throw new Error('Identitas lembar rusak.'); }
    if (!meta || meta.version !== VERSION || typeof meta.participantId !== 'string' || !meta.participantId || meta.participantId.length > 250 || typeof meta.moduleId !== 'string' || !['A', 'B'].includes(meta.lane) || !/^[a-f0-9]{64}$/.test(meta.digest || '') || typeof meta.rubricVersion !== 'string' || typeof meta.sourceVersion !== 'string' || typeof meta.caseId !== 'string' || !meta.caseId || meta.caseId.length > 300 || !Number.isInteger(meta.attempt) || meta.attempt < 1 || !Array.isArray(meta.fieldIds) || !meta.fieldIds.length || meta.fieldIds.length > 200 || meta.fieldIds.some(v => !validId(v)) || new Set(meta.fieldIds).size !== meta.fieldIds.length) throw new Error('Penanda kasus pada berkas tidak sesuai. Unduh lembar baru.');
    const d = parseXml(await z.file('word/document.xml').async('string'), 'Isi lembar');
    const answers = Object.create(null);
    const rowLabels = Object.create(null);
    const prompts = new Map();
    const allowed = new Set(meta.fieldIds);
    const controls = Array.from(d.getElementsByTagNameNS(W, 'sdt'));
    const seenAnswers = new Set();
    for (const sdt of controls) {
      const tag = tagged(sdt);
      const promptTag = tag === 'KADER-IDENTITAS' || tag === 'KADER-NARASI' || /^KADER-SOAL-\d+$/.test(tag);
      if (promptTag) {
        if (prompts.has(tag)) throw new Error('Penanda lembar berubah atau ganda. Unduh lembar baru.');
        prompts.set(tag, readText(children(sdt, 'sdtContent')[0]));
      }
      if (!tag.startsWith('KADER-ROW|')) continue;
      const id = tag.slice('KADER-ROW|'.length);
      if (!allowed.has(id) || Object.hasOwn(answers, id)) throw new Error('Penanda kolom berubah atau ganda. Unduh lembar baru.');
      const row = nearest(sdt, 'tr');
      const cells = children(row, 'tc');
      if (cells.length !== 3 || nearest(sdt, 'tc') !== cells[1] || readText(cells[0]) !== String(meta.fieldIds.indexOf(id) + 1)) throw new Error('Susunan baris berubah. Unduh lembar baru.');
      const answerControls = Array.from(cells[2].getElementsByTagNameNS(W, 'sdt'));
      if (answerControls.length !== 1) throw new Error('Kolom jawaban tidak lengkap atau ganda. Unduh lembar baru.');
      const answer = answerControls[0];
      const answerTag = tagged(answer);
      const dropdown = children(children(answer, 'sdtPr')[0], 'dropDownList').length > 0;
      if (answerTag !== 'KADER|' + id && (answerTag || !dropdown)) throw new Error('Penanda jawaban berubah atau ganda. Unduh lembar baru.');
      seenAnswers.add(answer);
      rowLabels[id] = readText(children(sdt, 'sdtContent')[0]);
      let value = readText(children(answer, 'sdtContent')[0]);
      if (value === PLACEHOLDER || /^[_\s—–-]*$/.test(value)) value = '';
      if (value.length > 1500) throw new Error('Jawaban terlalu panjang. Periksa kolom ' + id + '.');
      answers[id] = value;
    }
    if (controls.some(control => tagged(control).startsWith('KADER|') && !seenAnswers.has(control))) throw new Error('Penanda jawaban berada di luar baris yang sesuai.');
    if (Object.keys(answers).length !== meta.fieldIds.length) throw new Error('Sebagian kolom jawaban terhapus. Unduh lembar baru dan pindahkan jawaban Anda.');
    const narrative = prompts.get('KADER-NARASI');
    if (!narrative || !prompts.get('KADER-IDENTITAS')) throw new Error('Narasi atau identitas lembar tidak lengkap.');
    const identity = 'Kode peserta ' + meta.participantId + ' | Modul ' + meta.moduleId + ' | Kasus ' + meta.lane + ' | Percobaan ' + meta.attempt + ' Kode lembar ' + meta.caseId + ' | Versi rubrik ' + meta.rubricVersion + ' | Versi sumber ' + meta.sourceVersion;
    if (KaderWorkshop.clean(prompts.get('KADER-IDENTITAS')) !== identity) throw new Error('Identitas tercetak pada lembar berubah. Unduh lembar baru.');
    const questions = Array.from({length: prompts.size - 2}, (_, i) => prompts.get('KADER-SOAL-' + (i + 1)));
    if (questions.some(q => !q)) throw new Error('Soal pada lembar tidak lengkap.');
    return { metadata: meta, answers, rowLabels, instructions: [narrative, ...questions].join(' ') };
  }

  function humanDate(value) {
    const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value);
    return date.toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'});
  }
  const score = value => Number(value).toLocaleString('id-ID', {maximumFractionDigits: 2});
  const signers = [
    ['Menyetujui,', 'Dr. Trevino Aristarkus Pakasi, FS, MS, Ph.D., Sp.KKLP, Subsp.FOMC'],
    ['Hormat saya,', 'Dr.dr.Tirta Darmawan Susanto, MKes.']
  ];
  const last = values => values[values.length - 1];
  const qualified = record => ['A', 'B'].every(lane => last(record[lane].attempts)?.result.pass === true);
  const certificateNumber = (m, p, r) => 'WS-' + m.id + '-' + pid(p).slice(-12) + '-' + r.completedAt.slice(0, 10);

  function blocks(module, profile, record) {
    const out = [];
    const push = (value, style = 'body') => out.push({text: value, style});
    push('SERTIFIKAT KELULUSAN WORKSHOP', 'title');
    push(module.title, 'subtitle');
    push('Nomor ' + certificateNumber(module, profile, record), 'small');
    push('Peserta memenuhi ketentuan kelulusan Kasus A dan Kasus B.');
    const info = [
      ['Nama lengkap', name(profile)], ['Alamat', profile.address], ['Tanggal lahir', humanDate(profile.dob)],
      ['Usia', profile.age + ' tahun'], ['Nama Puskesmas', profile.puskesmas], ['Nama Posyandu', profile.posyandu],
      ['Pendidikan', profile.education], ['Pengalaman pelatihan kartu bantu', profile.priorTraining]
    ];
    info.forEach(([label, value]) => push(label + ' · ' + text(value), 'detail'));
    for (const lane of ['A', 'B']) {
      const attempts = record[lane].attempts;
      const latest = last(attempts).result;
      push('Kasus ' + lane + ' · ' + score(latest.score) + '% · Lulus · ' + attempts.length + ' percobaan', 'result');
    }
    push('Tanggal selesai · ' + humanDate(record.completedAt), 'detail');
    push(signers.map(s => s.join('\n')).join('\n\n'), 'signatures');
    push('RIWAYAT PENILAIAN WORKSHOP', 'newpage');
    for (const lane of ['A', 'B']) {
      push('Kasus ' + lane, 'heading');
      for (const attempt of record[lane].attempts) {
        const result = attempt.result;
        push('Percobaan ' + attempt.caseData.attempt + ' · ' + attempt.caseData.id + ' · ' + (result.pass ? 'Lulus' : 'Belum lulus'), 'attempt');
        push('Nilai ' + score(result.score) + '% (' + result.correct + '/' + result.total + ') · Salah ' + score(result.wrongPct) + '% · Kosong ' + score(result.blankPct) + '% · Tidak Berlaku ' + result.nonApplicable);
        push('Wajib lengkap ' + (result.requiredComplete ? 'ya' : 'tidak') + ' · Kritis benar ' + (result.criticalCorrect ? 'ya' : 'tidak') + ' · Status Tidak Berlaku tepat ' + (result.nonApplicableCorrect ? 'ya' : 'tidak'));
        push('Versi rubrik ' + attempt.caseData.rubricVersion + ' · Versi sumber ' + attempt.caseData.sourceVersion);
        const errors = result.items.filter(item => item.status !== 'correct');
        if (!errors.length) push('Semua jawaban tepat.');
        for (const item of errors) {
          push(item.label + (item.critical ? ' · Kritis' : ''), 'question');
          push(item.reference + ' · ' + (item.status === 'blank' ? 'Belum dijawab' : item.invalidChoice ? 'Kode atau pilihan tidak dikenali' : 'Jawaban belum tepat'));
          push('Jawaban peserta · ' + text(item.answer));
          push('Jawaban yang diterima · ' + (item.expectedCode ? item.expectedCode + ' - ' : '') + item.expected);
        }
      }
    }
    return out;
  }
  function linesOf(ctx, str, maxWidth) {
    const lines = [];
    for (const paragraph of String(str).split('\n')) {
      if (!paragraph) { lines.push(''); continue; }
      let line = '';
      for (const token of paragraph.split(/\s+/)) {
        if (ctx.measureText((line ? line + ' ' : '') + token).width <= maxWidth) { line += (line ? ' ' : '') + token; continue; }
        if (line) { lines.push(line); line = ''; }
        if (ctx.measureText(token).width <= maxWidth) { line = token; continue; }
        for (const ch of Array.from(token)) {
          if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ''; }
          line += ch;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  const PAGE_W = 1200, PAGE_H = 1697;
  const styles = {
    title: { size: 48, weight: 'bold', color: '#103a59', gap: 18, center: true },
    subtitle: { size: 34, weight: 'bold', color: '#1b506f', gap: 18, center: true },
    small: { size: 22, color: '#526476', gap: 24, center: true },
    body: { size: 27, color: '#16344c', gap: 15 },
    detail: { size: 26, color: '#16344c', gap: 12 },
    result: { size: 28, weight: 'bold', color: '#155c45', gap: 20 },
    heading: { size: 34, weight: 'bold', color: '#104b71', gap: 16 },
    newpage: { size: 38, weight: 'bold', color: '#104b71', gap: 28 },
    attempt: { size: 27, weight: 'bold', color: '#155d7f', gap: 14 },
    question: { size: 27, weight: 'bold', color: '#213c52', gap: 10 }
  };
  function layout(all, identifiers) {
    const c = document.createElement('canvas'); c.width = PAGE_W; c.height = PAGE_H;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Perangkat belum dapat membuat sertifikat gambar.');
    ctx.font = '17px Arial';
    const headerLines = identifiers.flatMap(str => linesOf(ctx, str, PAGE_W - 150));
    const header = {lines: headerLines, height: headerLines.length * 24 + 24};
    const startY = 45 + header.height + 34;
    if (startY > 800) throw new Error('Data pengenal sertifikat terlalu panjang. Periksa kode peserta dan nomor sertifikat.');
    const firstEnd = all.findIndex(b => b.style === 'signatures');
    const mainBlocks = all.slice(0, firstEnd < 0 ? all.length : firstEnd);
    const scaled = (s, factor) => ({ ...s, size: Math.round(s.size * factor), gap: Math.round(s.gap * factor) });
    const measureMain = factor => mainBlocks.reduce((height, b) => {
      const s = scaled(styles[b.style] || styles.body, factor);
      ctx.font = (s.weight || 'normal') + ' ' + s.size + 'px Arial';
      return height + linesOf(ctx, b.text, PAGE_W - 180).length * Math.ceil(s.size * 1.38) + s.gap;
    }, 0);
    let mainScale = 1;
    while (measureMain(mainScale) > 1320 - startY && mainScale > 0.625) mainScale -= 0.025;
    if (measureMain(mainScale) > 1320 - startY) throw new Error('Data sertifikat terlalu panjang. Periksa kembali panjang data pribadi Anda.');
    const pages = [[]]; let y = startY;
    const next = () => { pages.push([]); y = startY; };
    for (let bi = 0; bi < all.length; bi++) {
      const b = all[bi];
      if (b.style === 'signatures') { pages[0].signatures = true; continue; }
      if (b.style === 'newpage') next();
      const s = bi < firstEnd ? scaled(styles[b.style] || styles.body, mainScale) : (styles[b.style] || styles.body);
      ctx.font = (s.weight || 'normal') + ' ' + s.size + 'px Arial';
      const lines = linesOf(ctx, b.text, PAGE_W - 180);
      const lh = Math.ceil(s.size * 1.38);
      const bottom = () => pages.length === 1 ? 1320 : PAGE_H - 150;
      if (y + Math.min(lines.length, 3) * lh + s.gap > bottom() && y > startY + 20) next();
      for (const line of lines) {
        if (y + lh > bottom()) next();
        pages[pages.length - 1].push({ line, y, ...s });
        y += lh;
      }
      y += s.gap;
    }
    c.width = c.height = 1;
    return {pages, header};
  }
  function drawPage(c, ops, index, count, header) {
    c.width = PAGE_W; c.height = PAGE_H; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.strokeStyle = '#61b8df'; ctx.lineWidth = 5; ctx.strokeRect(30, 30, PAGE_W - 60, PAGE_H - 60);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e9f7ff'; ctx.fillRect(45, 45, PAGE_W - 90, header.height);
    ctx.fillStyle = '#285672'; ctx.font = '17px Arial'; ctx.textAlign = 'left';
    header.lines.forEach((line,i)=>ctx.fillText(line,75,57+i*24));
    ops.forEach(op => {
      ctx.font = (op.weight || 'normal') + ' ' + op.size + 'px Arial'; ctx.fillStyle = op.color;
      ctx.textAlign = op.center ? 'center' : 'left'; ctx.fillText(op.line, op.center ? PAGE_W / 2 : 90, op.y);
    });
    if (ops.signatures) {
      ctx.fillStyle = '#16344c'; ctx.font = '25px Arial'; ctx.textAlign = 'left';
      const left = [signers[0][0], '', ...linesOf(ctx, signers[0][1], 480)];
      const right = [signers[1][0], '', ...linesOf(ctx, signers[1][1], 455)];
      left.forEach((line, i) => ctx.fillText(line, 90, 1370 + i * 36));
      right.forEach((line, i) => ctx.fillText(line, 655, 1370 + i * 36));
    }
    ctx.textAlign = 'center'; ctx.font = '21px Arial'; ctx.fillStyle = '#476175';
    ctx.fillText('Halaman ' + (index + 1) + ' dari ' + count, PAGE_W / 2, PAGE_H - 100);
  }
  const canvasBlob = (c, quality = 0.9) => new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('Gambar sertifikat belum dapat dibuat. Coba gunakan peramban lain.')), 'image/jpeg', quality));
  async function certificate(module, profile, record) {
    if (!module?.id || !pid(profile) || !record.completedAt || !qualified(record)) throw new Error('Selesaikan Kasus A dan Kasus B untuk membuka sertifikat.');
    const all = blocks(module, profile, record);
    const versions = [...new Set(['A', 'B'].flatMap(lane => record[lane].attempts.map(a => a.caseData.rubricVersion)))].join(', ');
    const {pages, header} = layout(all, ['Kode peserta ' + pid(profile) + ' | Modul ' + module.id, 'Nomor sertifikat ' + certificateNumber(module, profile, record), 'Versi rubrik ' + versions]);
    const jpegImages = [];
    const cols = pages.length <= 12 ? 1 : Math.ceil(Math.sqrt(pages.length * 0.7));
    const rows = Math.ceil(pages.length / cols);
    const scale = Math.min(1, Math.sqrt(14000000 / (cols * rows * PAGE_W * PAGE_H)), 30000 / (rows * PAGE_H), 12000 / (cols * PAGE_W));
    if (!Number.isFinite(scale) || scale < 0.08) throw new Error('Riwayat terlalu panjang untuk satu gambar pada perangkat ini. Simpan cadangan pekerjaan dan gunakan perangkat dengan memori lebih besar.');
    const output = document.createElement('canvas'); output.width = Math.max(1, Math.floor(cols * PAGE_W * scale)); output.height = Math.max(1, Math.floor(rows * PAGE_H * scale));
    const oc = output.getContext('2d'); if (!oc) throw new Error('Perangkat belum dapat menyiapkan gambar sertifikat.');
    oc.fillStyle = '#d8effd'; oc.fillRect(0, 0, output.width, output.height);
    const scratch = document.createElement('canvas');
    for (let i = 0; i < pages.length; i++) {
      drawPage(scratch, pages[i], i, pages.length, header);
      jpegImages.push(await canvasBlob(scratch));
      oc.drawImage(scratch, Math.floor((i % cols) * PAGE_W * scale), Math.floor(Math.floor(i / cols) * PAGE_H * scale), Math.ceil(PAGE_W * scale), Math.ceil(PAGE_H * scale));
    }
    const jpeg = await canvasBlob(output, 0.94);
    scratch.width = scratch.height = output.width = output.height = 1;
    const message = 'WORKSHOP KARTU BANTU KADER · ' + module.id + ' · ' + pid(profile) + '\n\n' + all.map(b => b.text).join('\n\n') + '\n\nJumlah halaman paket: ' + pages.length + '.';
    return {jpeg, message, pageCount: pages.length, pagePreviews: jpegImages};
  }
  window.KaderWorkshopFiles = Object.freeze({createWorksheet, readWorksheet, certificate, version: VERSION});
}());
