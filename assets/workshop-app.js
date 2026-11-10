(() => {
  'use strict';

  const PAGE = document.body.dataset.module;
  const ROOT = document.getElementById('app');
  const FILES = {M01:'m01-ibu-hamil.html', M02:'m02-ibu-nifas.html', M03:'m03-bayi-balita.html', M04:'m04-remaja.html', M05:'m05-dewasa.html', M06:'m06-lansia-aks.html', M07:'m07-lansia-skilas.html'};
  const EDUCATIONS = ['Tidak sekolah', 'SD atau sederajat', 'SMP atau sederajat', 'SMA/SMK atau sederajat', 'Diploma', 'Sarjana', 'Pascasarjana'];
  const EXPERIENCE = ['Sudah pernah', 'Belum pernah'];
  const WA = 'https://wa.me/62811194085';
  const appTitle = 'Workshop Pengisian Kartu Bantu Kader';
  const GUIDE = {
    M01: ['Ibu Rina sedang hamil 24 minggu.', 'Usia kehamilan (minggu)', ['24', '8', '30']],
    M02: ['Petugas memberikan dua kapsul vitamin A. Ibu belum meminumnya.', 'Konsumsi vitamin A', ['Tidak', 'Ya', 'Tidak berlaku']],
    M03: ['Umur anak pada kunjungan contoh adalah 8 bulan.', 'Umur (bulan)', ['8', '24', '12']],
    M04: ['Lembar hasil pada kasus contoh menulis Hb 12 g/dL.', 'Hb sesuai lembar hasil', ['12 g/dL', '12 mg/dL', '12']],
    M05: ['Petugas menetapkan bahwa PUMA berlaku. Tujuh skornya adalah 1, 1, 2, 1, 1, 1, dan 1.', 'Jumlah PUMA', ['8', '7', '6']],
    M06: ['Jumlah AKS pada kasus contoh adalah 19.', 'Tingkat ketergantungan', ['Ringan', 'Mandiri', 'Sedang']],
    M07: ['Petugas mencatat tes bisik tidak dapat dilakukan.', 'Status tes bisik', ['Tidak dapat dilakukan', 'Dapat dilakukan']]
  };
  const $ = id => document.getElementById(id);
  const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const recent = attempts => attempts[attempts.length - 1];
  const passed = section => recent(section.attempts)?.result.pass === true;
  const format = number => number.toLocaleString('id-ID', {maximumFractionDigits: 2});
  const when = date => new Date(date).toLocaleString('id-ID', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta'});
  const isIndex = PAGE === 'index';
  const moduleList = window.KADER_CONTENT?.modules || [];
  const topic = moduleList.find(m => m.id === PAGE);
  let session, lane = 'A', upload, uploadSequence = 0, busy = false, certificatePromise;
  let previews = [];

  function ymd(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function ageFromDob(value, today = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value > ymd(today)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(0);
    date.setFullYear(y, m - 1, d);
    if (!y || date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) return null;
    return today.getFullYear() - y - Number(today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d));
  }

  function getProfile(form) {
    const profile = Object.fromEntries(new FormData(form));
    const limits = {fullName: 120, address: 500, puskesmas: 160, posyandu: 160};
    for (const [key, limit] of Object.entries(limits)) {
      const value = profile[key]?.trim();
      if (!value || value.length > limit || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) throw new Error('Lengkapi semua data peserta sesuai batas kolom.');
      profile[key] = value;
    }
    if (!/\p{L}/u.test(profile.fullName) || profile.fullName.length < 2) throw new Error('Tuliskan nama lengkap Anda.');
    profile.age = ageFromDob(profile.dob);
    if (profile.age === null) throw new Error('Tanggal lahir harus benar dan tidak melewati hari ini.');
    if (!EDUCATIONS.includes(profile.education) || !EXPERIENCE.includes(profile.priorTraining)) throw new Error('Pilih pendidikan dan pengalaman pelatihan dari daftar.');
    profile.id = crypto.randomUUID();
    profile.registeredAt = new Date().toISOString();
    return profile;
  }

  function photo(index, extra = '') {
    const key = index ? 'm' + String(index).padStart(2, '0') : 'index';
    return `<div class="photo workshop-photo ${extra}" style="background-position:${(index % 4) * 100 / 3}% ${index > 3 ? 100 : 0}%"><img src="assets/photos/${key}.webp" alt="" hidden></div>`;
  }

  function attachImages() {
    ROOT.querySelectorAll('.workshop-photo img').forEach(img => {
      const show = () => { if (img.naturalWidth) img.hidden = false; };
      if (img.complete) show();
      else img.addEventListener('load', show, {once: true});
    });
  }

  function shell(title, lead, content) {
    const index = isIndex ? 0 : moduleList.findIndex(m => m.id === PAGE) + 1;
    const actions = session.profile ? '<button class="btn secondary small" id="save-workshop">Simpan pekerjaan</button><button class="btn danger small" id="reset-workshop">Peserta baru / reset</button>' : '';
    document.title = isIndex ? appTitle : topic.short + ' • ' + appTitle;
    return `<div class="wrap"><header class="topbar"><a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">▤</span><span>Kartu Bantu<br><span class="muted small">Workshop Kader</span></span></a><div class="top-actions">${actions}</div></header>
      <section class="hero workshop-hero"><div><div class="eyebrow">${e(isIndex ? 'Tujuh kartu • Dua kasus per kartu' : topic.short + ' • Latihan pengisian')}</div><h1>${e(title)}</h1><p class="lead">${e(lead)}</p><span class="tag">${isIndex ? 'Pilih urutan latihan Anda' : 'Kasus A ≥80% · Kasus B ≥80%'}</span></div>${photo(index, 'hero-photo')}</section>
      <main><div id="workshop-errors" class="form-error" role="alert"></div><div id="workshop-status" class="notice good" role="status"></div>${content}</main>
      <footer class="bottom-bar"><span>${appTitle}</span><span>Isi kartu, periksa hasil, dan simpan arsip latihan.</span></footer></div>
      <dialog id="reset-dialog"><h2>Mulai untuk peserta baru?</h2><p>Data peserta, riwayat, dan arsip Workshop pada peramban ini akan dikosongkan. Unduh arsip yang masih diperlukan sebelum melanjutkan.</p><div class="actions"><button class="btn secondary" id="cancel-reset">Batal</button><button class="btn danger" id="confirm-reset">Kosongkan data</button></div></dialog>`;
  }

  function profileForm() {
    return `<form id="profile-form"><h2>Isi data Anda sebelum memilih kartu</h2><p class="muted">Semua kolom wajib diisi. Aplikasi menghitung usia dari tanggal lahir.</p><div class="field-grid">
      <div class="field full"><label for="fullName">Nama lengkap</label><input id="fullName" name="fullName" required maxlength="120" autocomplete="name"></div>
      <div class="field full"><label for="address">Alamat</label><textarea id="address" name="address" required maxlength="500" autocomplete="street-address"></textarea></div>
      <div class="field"><label for="dob">Tanggal lahir</label><input type="date" id="dob" name="dob" required max="${ymd()}"></div>
      <div class="field"><label for="age">Usia otomatis</label><input id="age" readonly aria-live="polite"></div>
      <div class="field"><label for="puskesmas">Nama Puskesmas</label><input id="puskesmas" name="puskesmas" required maxlength="160"></div>
      <div class="field"><label for="posyandu">Nama Posyandu</label><input id="posyandu" name="posyandu" required maxlength="160"></div>
      <div class="field full"><label for="education">Pendidikan</label><select id="education" name="education" required><option value="">Pilih pendidikan</option>${EDUCATIONS.map(value => `<option>${e(value)}</option>`).join('')}</select></div></div>
      <fieldset class="workshop-hint"><legend>Apakah Anda sudah pernah mengetahui atau ikut pelatihan cara mengisi Kartu Bantu Kader?</legend><div class="choices">${EXPERIENCE.map(value => `<label class="choice"><input type="radio" name="priorTraining" value="${value}" required><span>${value}</span></label>`).join('')}</div></fieldset>
      <button class="btn glow" id="submit-profile" type="submit">Simpan data &amp; pilih kartu →</button></form>`;
  }

  function indexView() {
    const p = session.profile;
    const profile = p ? `<div class="notice good"><strong>${e(p.fullName)}</strong><br>${e(p.posyandu)} · ${e(p.puskesmas)}<br><span class="small">${e(p.address)} · Usia ${p.age} tahun · Kode ${e(KaderWorkshop.participantCode(p))}</span></div><p>Jika data sudah tepat, pilih kartu yang ingin Anda kerjakan.</p>` : profileForm();
    const cards = moduleList.map((module, index) => {
      const record = session.modules[module.id];
      const status = record?.completedAt ? 'Lulus A dan B' : record ? 'Lanjutkan latihan' : 'Buka latihan';
      const inside = `${photo(index + 1)}<div><h3>${e(module.short)}</h3><p>${e(module.hook)}</p>${p ? `<span class="tag">${status} →</span>` : '<p>Isi data peserta untuk membuka kartu.</p>'}</div>`;
      return p ? `<a class="module-card" id="open-${module.id}" href="${FILES[module.id]}">${inside}</a>` : `<div class="module-card locked" aria-disabled="true">${inside}</div>`;
    }).join('');
    ROOT.innerHTML = shell(appTitle, 'Seberapa tepat Anda mengisi kartu? Coba dua kasus dan lihat kolom mana yang sudah Anda kuasai.', `<div class="content-grid"><div><section class="panel">${profile}</section><section class="panel" id="module-options"><h2>Kartu mana yang ingin Anda kerjakan?</h2><div class="module-grid">${cards}</div></section></div><aside class="sidebar workshop-side"><section class="panel"><h3>Langkah Anda</h3><p>Isi data, pilih kartu, lalu kerjakan Kasus A dan Kasus B.</p><p>Setiap kasus harus memperoleh minimal 80%. Kolom wajib harus lengkap, jawaban kritis harus benar, dan status Tidak Berlaku harus tepat.</p>${p ? '<button class="btn ghost small" id="all-archives">Unduh arsip semua kartu</button>' : ''}</section></aside></div>`);
    const form = $('profile-form');
    if (form) {
      $('dob').addEventListener('input', () => {
        const age = ageFromDob($('dob').value);
        $('age').value = age === null ? '' : age + ' tahun';
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        run($('submit-profile'), async () => {
          const profileData = getProfile(form);
          session = await KaderWorkshopStore.commit(session.revision, {...session, profile: profileData});
          render();
          $('module-options').scrollIntoView({block: 'start'});
        });
      });
    }
    $('all-archives')?.addEventListener('click', event => run(event.currentTarget, () => archiveZip(Object.keys(session.modules))));
  }

  function guide() {
    const rubric = WORKSHOP_RUBRIC[PAGE];
    const [sample, field, options] = GUIDE[PAGE];
    const choices = options.slice(1).concat(options[0]);
    return `<section class="panel workshop-panel" id="workshop-guide"><h2>Kenali kolom sebelum mengisi</h2><details><summary>Tujuan latihan dan rujukan kolom</summary><ul class="workshop-list">${rubric.objectives.map(objective => `<li><strong>${e(objective.title)}</strong><br>${e(objective.goal)}<br><a href="referensi/${PAGE.toLowerCase()}.pdf" target="_blank" rel="noopener">${e(objective.source)} ↗</a></li>`).join('')}</ul></details>
      <div class="example workshop-guided"><h3>Contoh latihan terpandu</h3><p>${e(sample)}</p><form id="guide-form"><label for="guide-answer">${e(field)}</label><select id="guide-answer" required><option value="">Pilih isian contoh</option>${choices.map(option => `<option>${e(option)}</option>`).join('')}</select><div class="actions"><button type="submit" class="btn secondary small">Periksa isian contoh</button></div><p id="guide-result" role="status"></p></form></div>
      <ol class="workshop-steps"><li><span aria-hidden="true">↓</span>Unduh lembar</li><li><span aria-hidden="true">✎</span>Isi kolom</li><li><span aria-hidden="true">↑</span>Unggah DOCX</li><li><span aria-hidden="true">✓</span>Periksa hasil</li></ol>
      <p class="small">Pada lembar tugas, tulis data sesuai kasus. Jika petugas menyatakan suatu kolom Tidak Berlaku, pilih status tersebut.</p></section>`;
  }

  function resultMetrics(result) {
    return `<div class="metric-grid workshop-metrics"><div class="metric good"><strong>${format(result.score)}%</strong><span>Benar</span></div><div class="metric bad"><strong>${format(result.wrongPct)}%</strong><span>Salah</span></div><div class="metric blank"><strong>${format(result.blankPct)}%</strong><span>Kosong</span></div><div class="metric"><strong>${result.nonApplicable}</strong><span>Tidak Berlaku</span></div></div>
      <p class="small">${result.correct} benar dari ${result.total} kolom yang berlaku. Nilai = ${result.correct} ÷ ${result.total} × 100.</p>
      <dl><dt>Kolom wajib</dt><dd>${result.requiredComplete ? 'Lengkap' : 'Belum lengkap'}</dd><dt>Jawaban kritis</dt><dd>${result.criticalCorrect ? 'Semua benar' : 'Ada yang perlu diperbaiki'}</dd><dt>Status Tidak Berlaku</dt><dd>${result.nonApplicableCorrect ? 'Tepat' : 'Ada yang perlu diperbaiki'}</dd></dl>`;
  }

  function answerLabel(item) {
    return (item.expectedCode ? item.expectedCode + ' - ' : '') + item.expected;
  }

  function correctionItems(result, all = false) {
    const list = all ? result.items : result.items.filter(item => item.status !== 'correct');
    if (!list.length) return '<p>Semua jawaban tepat.</p>';
    return list.map(item => `<article class="review-item ${item.status}"><strong>${e(item.label)}</strong>${item.critical ? ' <span class="tag">Kritis</span>' : ''}${!item.applicable ? ' <span class="tag">Tidak Berlaku</span>' : ''}<p>${e(item.reference)} · <a href="${item.source}" target="_blank" rel="noopener">Kartu sumber ↗</a></p><p>Jawaban Anda · ${e(item.answer || 'Belum dijawab')}</p><p>${item.status === 'correct' ? 'Benar' : item.invalidChoice ? 'Kode atau pilihan tidak dikenali' : item.status === 'blank' ? 'Belum dijawab' : 'Perlu diperbaiki'} · Isian yang diterima <strong>${e(answerLabel(item))}</strong></p></article>`).join('');
  }

  function attemptSummary(attempt) {
    const result = attempt.result;
    const id = `${attempt.caseData.lane}-${attempt.caseData.attempt}`;
    return `<article class="workshop-result"><h3>Percobaan ${attempt.caseData.attempt} · ${result.pass ? 'Lulus' : 'Belum lulus'}</h3><p class="small">${e(when(attempt.submittedAt))} WIB · Versi rubrik ${e(attempt.caseData.rubricVersion)} · ${e(attempt.caseData.id)}</p>${resultMetrics(result)}<div class="actions report-actions"><button class="btn secondary small" data-report="${id}">Unduh laporan ${result.pass ? 'hasil' : 'koreksi'}</button><button class="btn ghost small" data-archive="${id}">Unduh arsip percobaan</button></div><details><summary>Lihat jawaban dan koreksi</summary>${correctionItems(result, true)}</details></article>`;
  }

  function taskView(section) {
    if (passed(section)) return '<div class="notice good">Kasus ini sudah lulus. Nilai dan jawaban tetap tersimpan pada riwayat.</div>';
    const c = section.activeCase;
    return `<div id="active-case"><h2>${e(c.title)}</h2><div class="attempt-badge">Percobaan ${c.attempt}</div><p class="case-text">${e(c.narrative)}</p><h3>Pertanyaan penerapan</h3><ol class="case-questions">${c.questions.map(q => `<li>${e(q.text)}</li>`).join('')}</ol><div class="actions"><button class="btn" id="download-docx">Unduh lembar DOCX ↓</button></div>
      <div class="upload-zone"><label for="upload-docx">Unggah DOCX yang sudah Anda isi</label><p class="small">Gunakan lembar kasus yang tampil. Pertahankan nama dan kode peserta pada nama berkas.</p><input type="file" id="upload-docx" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><div id="upload-state" aria-live="polite"></div></div></div>`;
  }

  function certificateView(record) {
    if (!record.completedAt) return '';
    return `<section class="panel workshop-panel" id="workshop-certificate"><div class="certificate"><div class="eyebrow">Sertifikat Workshop</div><h2>Anda lulus Kasus A dan Kasus B</h2><p class="person">${e(session.profile.fullName)}</p><p>Kasus A ${format(recent(record.A.attempts).result.score)}% · Kasus B ${format(recent(record.B.attempts).result.score)}%</p></div>
      <p id="certificate-filename" class="small file-name"></p><div class="actions"><button class="btn" id="download-jpeg" disabled>Unduh sertifikat JPEG ↓</button></div><details class="workshop-preview"><summary>Periksa halaman sertifikat dan riwayat</summary><div id="certificate-pages" aria-live="polite"><p>Gambar sedang disiapkan.</p></div></details>
      <div class="wa-box"><h3>Kirim hasil kepada dr. Trevino</h3><p>Tujuan +62 811-194-085</p><button class="btn glow" id="share-wa" disabled>Kirim sertifikat ke dr. Trevino</button><p id="wa-log" class="small">${record.waOpenedAt ? `Membuka WhatsApp · ${e(when(record.waOpenedAt))} WIB` : ''}</p><div id="share-options" hidden><ol class="help-list"><li>Unduh JPEG sertifikat. Lokasi simpan mengikuti pengaturan perangkat.</li><li>Salin pesan lengkap lalu buka chat dr. Trevino.</li><li>Lampirkan JPEG dan periksa pesan sebelum menekan Kirim di WhatsApp.</li></ol><div class="actions"><button class="btn secondary" id="copy-wa">Salin pesan lengkap</button><a class="btn" id="open-wa" href="${WA}" target="_blank" rel="noopener">Buka WhatsApp dr. Trevino ↗</a></div><label for="wa-message">Pesan sertifikat</label><textarea id="wa-message" readonly></textarea></div></div></section>`;
  }

  function moduleView() {
    const record = session.modules[PAGE];
    const section = record[lane];
    const attempts = section.attempts;
    const last = recent(attempts);
    const buttons = KaderWorkshop.LANES.map(key => {
      const selected = record[key];
      const label = passed(selected) ? 'Lulus' : `Percobaan ${selected.activeCase.attempt}`;
      return `<button class="btn ${key === lane ? '' : 'secondary'}" id="case-${key}" data-lane="${key}" aria-pressed="${key === lane}">Kasus ${key}<span>${label}</span></button>`;
    }).join('');
    const retry = last && !last.result.pass ? `<div class="notice">Laporan percobaan tersimpan. Anda bisa mengunduhnya sebelum mengerjakan kasus ${lane} yang baru.</div>` : '';
    const past = attempts.slice(0, -1).map(a => `<details><summary>Percobaan ${a.caseData.attempt} · ${format(a.result.score)}%</summary>${attemptSummary(a)}</details>`).join('');
    ROOT.innerHTML = shell(topic.hook, 'Terapkan cara pengisian kartu pada Kasus A dan Kasus B. Periksa hasil tiap kasus untuk mengetahui kolom yang perlu diperbaiki.', `<div class="content-grid"><div>${guide()}<section class="panel workshop-panel" id="workshop-task"><h2>Dua kasus untuk kartu ini</h2><div class="lane-tabs">${buttons}</div>${retry}${last ? attemptSummary(last) : ''}${taskView(section)}${past ? `<div class="workshop-history"><h3>Riwayat sebelumnya</h3>${past}</div>` : ''}</section>${certificateView(record)}</div>
      <aside class="sidebar workshop-side"><section class="panel"><h3>${e(session.profile.fullName)}</h3><p class="small">${e(session.profile.posyandu)} · ${e(session.profile.puskesmas)}</p><a class="btn secondary small" id="back-index" href="index.html">Pilih kartu lain</a><p><a href="referensi/${PAGE.toLowerCase()}.pdf" target="_blank" rel="noopener">Buka kartu sumber ↗</a></p><button class="btn ghost small" id="module-archives">Unduh arsip kartu ini</button></section></aside></div>`);
    $('guide-form').addEventListener('submit', event => {
      event.preventDefault();
      const correct = GUIDE[PAGE][2][0];
      $('guide-result').textContent = $('guide-answer').value === correct ? `Tepat. Kolom contoh berisi ${correct}.` : `Coba periksa lagi data contoh. Isian yang tepat adalah ${correct}.`;
    });
    ROOT.querySelectorAll('[data-lane]').forEach(button => button.addEventListener('click', () => {
      if (busy || lane === button.dataset.lane) return;
      clearUpload();
      lane = button.dataset.lane;
      render();
      $(`case-${lane}`).focus();
    }));
    $('download-docx')?.addEventListener('click', event => run(event.currentTarget, downloadWorksheet));
    $('upload-docx')?.addEventListener('change', readUpload);
    $('module-archives').addEventListener('click', event => run(event.currentTarget, () => archiveZip([PAGE])));
    ROOT.querySelectorAll('[data-report]').forEach(button => button.addEventListener('click', () => saveReport(attemptById(button.dataset.report))));
    ROOT.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', () => run(button, () => archiveZip([PAGE], attemptById(button.dataset.archive)))));
    if (record.completedAt) prepareCertificate(record);
  }

  function render() {
    previews.forEach(URL.revokeObjectURL);
    previews = [];
    if (isIndex) indexView();
    else moduleView();
    attachImages();
    $('save-workshop')?.addEventListener('click', () => {
      setStatus('Pekerjaan yang telah dinilai sudah tersimpan pada peramban ini. Simpan DOCX yang masih Anda isi di perangkat.');
    });
    $('reset-workshop')?.addEventListener('click', () => { if (!busy) $('reset-dialog').showModal(); });
    $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
    $('confirm-reset').addEventListener('click', event => run(event.currentTarget, async () => {
      session = await KaderWorkshopStore.commit(session.revision, null, null, true);
      clearUpload();
      location.replace('index.html');
    }));
  }

  function setStatus(message) {
    if ($('workshop-status')) $('workshop-status').textContent = message;
  }

  function setError(message) {
    if ($('workshop-errors')) $('workshop-errors').textContent = message;
  }

  async function run(button, fn) {
    if (busy) return;
    busy = true;
    if (button) button.disabled = true;
    setError('');
    setStatus('');
    try { await fn(); }
    catch (error) {
      setError(error.message || 'Langkah ini belum selesai. Coba kembali.');
      $('workshop-errors')?.scrollIntoView({block: 'nearest'});
    }
    finally {
      busy = false;
      if (button?.isConnected) button.disabled = false;
    }
  }

  function clearUpload() {
    upload = undefined;
    uploadSequence++;
    if ($('upload-docx')) $('upload-docx').value = '';
    if ($('upload-state')) $('upload-state').replaceChildren();
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const active = () => session.modules[PAGE][lane].activeCase;
  const participantName = () => KaderWorkshop.fileNameSlug(session.profile.fullName) + '_' + KaderWorkshop.participantCode(session.profile);
  const taskFileName = (c, suffix) => `${participantName()}_${PAGE}_${c.lane}_${c.attempt}_${suffix}`;

  async function downloadWorksheet() {
    const c = active();
    const blob = await KaderWorkshopFiles.createWorksheet(c, session.profile);
    download(blob, taskFileName(c, 'Lembar_Workshop.docx'));
    setStatus('Lembar tersedia. Buka DOCX lalu isi kolom jawaban.');
  }

  async function readUpload(event) {
    const file = event.target.files[0];
    if (busy) { event.target.value = ''; return; }
    upload = undefined;
    const sequence = ++uploadSequence;
    const c = active();
    const area = $('upload-state');
    area.textContent = file ? 'Memeriksa identitas lembar…' : '';
    if (!file) return;
    try {
      const parsed = await KaderWorkshopFiles.readWorksheet(file);
      if (sequence !== uploadSequence || !area.isConnected || active().id !== c.id) return;
      KaderWorkshop.checkUpload(parsed, file.name, c, session.profile);
      upload = {file, answers: parsed.answers, caseId: c.id};
      const rows = c.fields.map(field => `<tr><th scope="row">${e(field.label)}</th><td>${e(parsed.answers[field.id] || 'Belum dijawab')}</td></tr>`).join('');
      area.innerHTML = `<p class="file-name">${e(file.name)}</p><details class="upload-preview"><summary>Periksa jawaban yang terbaca</summary><div class="table-scroll"><table><thead><tr><th>Kolom</th><th>Jawaban Anda</th></tr></thead><tbody>${rows}</tbody></table></div></details><button class="btn glow" id="grade-docx">Nilai lembar yang sudah dijawab</button>`;
      $('grade-docx').addEventListener('click', ev => run(ev.currentTarget, gradeUpload));
      $('grade-docx').focus();
    } catch (error) {
      if (sequence !== uploadSequence || !area.isConnected) return;
      event.target.value = '';
      area.innerHTML = `<p class="form-error" role="alert">${e(error.message)}</p>`;
    }
  }

  async function gradeUpload() {
    const c = active();
    if (!upload || upload.caseId !== c.id) throw new Error('Unggah lembar yang sudah Anda isi.');
    const current = upload;
    const original = new Blob([await current.file.arrayBuffer()], {type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const originalSha256 = await KaderWorkshop.sha256(await original.arrayBuffer());
    const result = KaderWorkshop.grade(c, current.answers);
    const key = `${session.profile.id}/${PAGE}/${lane}/${c.attempt}`;
    const attempt = {key, submittedAt: new Date().toISOString(), originalName: current.file.name, originalSha256, caseData: c, result};
    const next = structuredClone(session);
    const record = next.modules[PAGE];
    record[lane].attempts.push(attempt);
    const prior = KaderWorkshop.LANES.flatMap(letter => {
      const item = record[letter];
      return [...item.attempts.map(a => a.caseData), item.activeCase].filter(Boolean);
    });
    record[lane].activeCase = result.pass ? null : await KaderWorkshop.makeCase(PAGE, session.profile, lane, c.attempt + 1, prior);
    if (passed(record.A) && passed(record.B)) record.completedAt = attempt.submittedAt;
    session = await KaderWorkshopStore.commit(session.revision, next, {key, attempt, original});
    clearUpload();
    render();
    setStatus(result.pass ? `Kasus ${lane} lulus dengan nilai ${format(result.score)}%.` : `Nilai Kasus ${lane} ${format(result.score)}%. Laporan tersedia dan kasus baru sudah disiapkan.`);
    $('workshop-task').scrollIntoView({block: 'start'});
  }

  function attemptById(id) {
    const [letter, num] = id.split('-');
    return session.modules[PAGE][letter].attempts[Number(num) - 1];
  }

  function reportText(attempt, module) {
    const c = attempt.caseData;
    return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Laporan penilaian Workshop</title><style>body{font:16px/1.6 Arial,sans-serif;color:#12334b;max-width:840px;padding:16px;margin:auto;overflow-wrap:anywhere}.review-item{border-top:1px solid #abcde4;padding:12px 0}.metric-grid{display:flex;gap:16px;flex-wrap:wrap}.metric span{display:block}dt{font-weight:bold}dd{margin:0 0 8px}a{color:#064d87}@media print{body{padding:0}}</style><body><main><h1>Laporan penilaian Workshop</h1><p>${e(module.short)} · Kasus ${c.lane} · Percobaan ${c.attempt} · ${attempt.result.pass ? 'Lulus' : 'Belum lulus'}</p><p>${e(session.profile.fullName)} · ${e(when(attempt.submittedAt))} WIB</p><p>Kode lembar ${e(c.id)} · Versi rubrik ${e(c.rubricVersion)} · Versi sumber ${e(c.sourceVersion)}</p>${resultMetrics(attempt.result)}<h2>Kolom yang perlu diperiksa</h2>${correctionItems(attempt.result).replace(/ <a href="referensi\/m\d+\.pdf" target="_blank" rel="noopener">Kartu sumber ↗<\/a>/g, ' Buka PDF sumber pada aplikasi.')}</main></body></html>`;
  }

  function saveReport(attempt) {
    download(new Blob([reportText(attempt, topic)], {type: 'text/html;charset=utf-8'}), taskFileName(attempt.caseData, 'Laporan_Penilaian.html'));
  }

  async function archiveZip(moduleIds, only) {
    const list = only ? [only] : moduleIds.flatMap(id => KaderWorkshop.LANES.flatMap(letter => session.modules[id][letter].attempts));
    if (!list.length) throw new Error('Arsip tersedia setelah Anda menilai lembar yang sudah diisi.');
    const zip = new JSZip();
    zip.file('Indeks_Arsip.json', JSON.stringify({app: session.app, version: session.version, profile: session.profile, attempts: list.map(a => ({key: a.key, originalSha256: a.originalSha256, caseId: a.caseData.id, score: a.result.score, pass: a.result.pass}))}, null, 2));
    for (const attempt of list) {
      const archive = await KaderWorkshopStore.readArchive(attempt.key);
      const c = archive.attempt.caseData;
      const folder = zip.folder(`${c.moduleId}/Kasus_${c.lane}/Percobaan_${c.attempt}`);
      const bytes = await archive.original.arrayBuffer();
      if (await KaderWorkshop.sha256(bytes) !== archive.attempt.originalSha256) throw new Error('Sidik berkas asli tidak cocok dengan catatan percobaan.');
      folder.file('Jawaban_Asli.docx', bytes);
      folder.file('Snapshot_Rubrik_dan_Hasil.json', JSON.stringify(archive.attempt, null, 2));
      folder.file('Laporan_Penilaian.html', reportText(archive.attempt, moduleList.find(m => m.id === c.moduleId)));
    }
    const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'});
    download(blob, `Arsip_Workshop_${participantName()}_${only ? `${only.caseData.moduleId}_${only.caseData.lane}_${only.caseData.attempt}` : moduleIds.length === 1 ? moduleIds[0] : 'Semua_Kartu'}.zip`);
    setStatus('Arsip sudah disiapkan. Berkas memuat data peserta dan jawaban asli.');
  }

  function prepareCertificate(record) {
    const section = $('workshop-certificate');
    const jpegButton = $('download-jpeg');
    const shareButton = $('share-wa');
    if (!certificatePromise) certificatePromise = KaderWorkshopFiles.certificate(topic, session.profile, record).catch(error => { certificatePromise = undefined; throw error; });
    certificatePromise.then(certificate => {
      if (!section.isConnected) return;
      const filename = `Sertifikat_Workshop_${participantName()}_${PAGE}.jpeg`;
      $('certificate-filename').textContent = filename;
      const image = new File([certificate.jpeg], filename, {type: 'image/jpeg'});
      const pageElements = certificate.pagePreviews.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        previews.push(url);
        return `<figure><figcaption>Halaman ${index + 1} dari ${certificate.pageCount}</figcaption><img class="preview-image" src="${url}" alt="Sertifikat halaman ${index + 1}" loading="lazy"></figure>`;
      });
      $('certificate-pages').innerHTML = pageElements.join('');
      $('wa-message').value = certificate.message;
      if (certificate.message.length < 3500) $('open-wa').href = WA + '?text=' + encodeURIComponent(certificate.message);
      $('open-wa').addEventListener('click', () => run(null, async () => {
        const time = new Date().toISOString();
        const next = structuredClone(session);
        next.modules[PAGE].waOpenedAt = time;
        session = await KaderWorkshopStore.commit(session.revision, next);
        $('wa-log').textContent = `Membuka WhatsApp · ${when(time)} WIB`;
      }));
      jpegButton.disabled = shareButton.disabled = false;
      jpegButton.addEventListener('click', () => download(certificate.jpeg, filename));
      shareButton.addEventListener('click', async () => {
        const share = {title: 'Sertifikat Workshop Kartu Bantu Kader', files: [image], text: certificate.message};
        $('share-options').hidden = false;
        try {
          if (navigator.share && navigator.canShare?.(share)) await navigator.share(share);
          else $('share-options').scrollIntoView({block: 'nearest'});
        } catch (error) {
          if (error.name !== 'AbortError') $('share-options').scrollIntoView({block: 'nearest'});
        }
      });
      $('copy-wa').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(certificate.message);
          setStatus('Pesan lengkap disalin.');
        } catch (_) {
          $('wa-message').focus();
          $('wa-message').select();
          setStatus('Teks dipilih. Gunakan perintah Salin pada perangkat Anda.');
        }
      });
    }).catch(error => {
      if (!section.isConnected) return;
      $('certificate-pages').textContent = error.message;
      setError(error.message);
    });
  }

  async function initialize() {
    try {
      session = await KaderWorkshopStore.load();
      if (!isIndex && (!topic || !session.profile)) { location.replace('index.html'); return; }
      if (!isIndex && !session.modules[PAGE]) {
        const A = await KaderWorkshop.makeCase(PAGE, session.profile, 'A', 1);
        const B = await KaderWorkshop.makeCase(PAGE, session.profile, 'B', 1, [A]);
        const modules = {...session.modules, [PAGE]: {A: {activeCase: A, attempts: []}, B: {activeCase: B, attempts: []}, completedAt: null}};
        session = await KaderWorkshopStore.commit(session.revision, {...session, modules});
      }
      if (!isIndex && passed(session.modules[PAGE].A) && !passed(session.modules[PAGE].B)) lane = 'B';
      render();
    } catch (error) {
      ROOT.innerHTML = `<div class="wrap"><section class="panel" style="margin-top:32px"><h1>Workshop belum dapat dibuka</h1><p class="form-error" role="alert">${e(error.message)}</p><a href="index.html">Kembali ke halaman awal</a></section></div>`;
    }
  }

  initialize();
  window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
})();
