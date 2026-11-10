(() => {
  'use strict';

  const DATABASE = 'kader-workshop-20261110';
  const APP = 'kader-workshop';
  const empty = revision => ({app: APP, version: 1, revision, profile: null, modules: {}});
  let opening;

  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('session');
        request.result.createObjectStore('archive', {keyPath: 'key'});
      };
      request.onerror = () => reject(new Error('Penyimpanan Workshop tidak dapat dibuka. Periksa izin penyimpanan peramban.'));
      request.onblocked = () => reject(new Error('Tutup tab Workshop lain, lalu buka halaman ini kembali.'));
      request.onsuccess = () => resolve(request.result);
    });
    return opening;
  }

  async function load() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readonly');
      const req = tx.objectStore('session').get('active');
      tx.oncomplete = () => resolve(req.result || empty(0));
      tx.onabort = () => reject(new Error('Pekerjaan Workshop belum dapat dibuka.'));
    });
  }

  async function commit(expectedRevision, next, archive, reset = false) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['session', 'archive'], 'readwrite');
      const stateStore = tx.objectStore('session');
      const archiveStore = tx.objectStore('archive');
      const req = stateStore.get('active');
      let conflict = false;
      let saved;
      req.onsuccess = () => {
        if ((req.result?.revision || 0) !== expectedRevision) {
          conflict = true;
          tx.abort();
          return;
        }
        saved = reset ? empty(expectedRevision + 1) : {...next, revision: expectedRevision + 1};
        if (reset) archiveStore.clear();
        if (archive) archiveStore.add(archive);
        stateStore.put(saved, 'active');
      };
      tx.oncomplete = () => resolve(saved);
      tx.onabort = () => reject(new Error(conflict ? 'Pekerjaan berubah di tab lain. Muat ulang halaman untuk membuka data terbaru.' : 'Pekerjaan belum tersimpan. Periksa ruang penyimpanan, lalu coba lagi.'));
    });
  }

  async function readArchive(key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('archive', 'readonly');
      const req = tx.objectStore('archive').get(key);
      tx.oncomplete = () => req.result ? resolve(req.result) : reject(new Error('Arsip percobaan ini belum ditemukan.'));
      tx.onabort = () => reject(new Error('Arsip Workshop belum dapat dibuka.'));
    });
  }

  window.KaderWorkshopStore = Object.freeze({load, commit, readArchive});
})();
