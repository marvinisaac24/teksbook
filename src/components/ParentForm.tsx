import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SENARAI_BUKU, BukuDiterima, BorangPenerimaan } from '../types';
import { STUDENTS_3_FLEKSIBEL } from '../data/students';
import SignatureCanvas from 'react-signature-canvas';
import { generateBorangAkuanPDF, generateRekodPerolehanPDF, getLogoBase64 } from '../lib/pdf';

export default function ParentForm() {
  const navigate = useNavigate();
  const [namaMurid, setNamaMurid] = useState('');
  const [tahun, setTahun] = useState('3');
  const [kelas, setKelas] = useState('');
  const [namaPenjaga, setNamaPenjaga] = useState('');
  const [hubungan, setHubungan] = useState<'Ibu' | 'Bapa' | 'Penjaga' | ''>('');
  const [tarikhPenerimaan, setTarikhPenerimaan] = useState('19 DISEMBER 2026'); // Fixed date based on prompt
  
  const [bukuState, setBukuState] = useState<Record<string, BukuDiterima>>(() => {
    const initialState: Record<string, BukuDiterima> = {};
    SENARAI_BUKU.forEach(buku => {
      initialState[buku.id] = { idBuku: buku.id, diterima: false, keadaan: '', noPerolehan: '', catatan: '' };
    });
    return initialState;
  });
  
  const [persetujuan, setPersetujuan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [appLogo, setAppLogo] = useState<string>('');
  const [submittedDocId, setSubmittedDocId] = useState<string | null>(null);
  const [savedSigPenjaga, setSavedSigPenjaga] = useState<string>('');
  const [savedSigMurid, setSavedSigMurid] = useState<string>('');

  useEffect(() => {
    if (!success) {
      setTimeout(() => {
        if (savedSigPenjaga && sigPenjagaRef.current && sigPenjagaRef.current.isEmpty()) {
          sigPenjagaRef.current.fromDataURL(savedSigPenjaga);
        }
        if (savedSigMurid && sigMuridRef.current && sigMuridRef.current.isEmpty()) {
          sigMuridRef.current.fromDataURL(savedSigMurid);
        }
      }, 100);
    }
  }, [success, savedSigPenjaga, savedSigMurid]);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const logoDoc = await getDoc(doc(db, 'settings', 'system_logo'));
        if (logoDoc.exists()) {
          setAppLogo(logoDoc.data().base64);
        }
      } catch (err) {
        console.error("Error fetching logo:", err);
      }
    };
    fetchLogo();
  }, []);

  const sigPenjagaRef = useRef<SignatureCanvas>(null);
  const sigMuridRef = useRef<SignatureCanvas>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setNamaMurid(val);
    const student = STUDENTS_3_FLEKSIBEL.find(s => s.nama === val);
    if (student) {
      setKelas('FLEKSIBEL');
      if (student.penjaga) {
        setNamaPenjaga(student.penjaga);
        setHubungan('Penjaga');
      }
    }
  };

  const jumlahDiterima = Object.values(bukuState).filter(b => b.diterima).length;

  const handleBukuChange = (id: string, field: keyof BukuDiterima, value: any) => {
    setBukuState(prev => {
      const newState = { ...prev, [id]: { ...prev[id], [field]: value } };
      
      // If unchecking "terima", clear keadaan & noPerolehan
      if (field === 'diterima' && !value) {
        newState[id].keadaan = '';
        newState[id].noPerolehan = '';
      }
      // If checking "terima", clear catatan (Belum diterima / Hilang)
      if (field === 'diterima' && value) {
        newState[id].catatan = '';
      }
      // If selecting catatan (Belum diterima / Hilang), mark as not diterima and clear keadaan & noPerolehan
      if (field === 'catatan' && value) {
        newState[id].diterima = false;
        newState[id].keadaan = '';
        newState[id].noPerolehan = '';
      }
      return newState;
    });
  };

  const validateForm = () => {
    if (!namaMurid.trim()) return 'Nama murid mesti diisi.';
    if (!kelas.trim()) return 'Kelas mesti diisi.';
    if (!namaPenjaga.trim()) return 'Nama ibu/bapa/penjaga mesti diisi.';
    if (!hubungan) return 'Hubungan dengan murid mesti dipilih.';
    if (jumlahDiterima === 0) return 'Sekurang-kurangnya satu buku mesti ditandakan sebagai diterima.';
    if (!persetujuan) return 'Kotak persetujuan mesti ditandakan.';
    if (sigMuridRef.current?.isEmpty()) return 'Sila turunkan tandatangan Murid.';
    if (sigPenjagaRef.current?.isEmpty()) return 'Sila turunkan tandatangan Penjaga.';

    for (const b of Object.values(bukuState)) {
      if (b.diterima) {
        if (!b.keadaan) return `Keadaan buku mesti dipilih bagi buku yang diterima.`;
        if (!b.noPerolehan.trim()) return `Nombor perolehan mesti diisi bagi setiap buku yang diterima.`;
      }
    }
    return '';
  };

  const handleDownloadDocs = async (type: 'doc1' | 'doc2' | 'both', tPenjaga?: string, tMurid?: string) => {
    // We try to grab the signatures if not provided (e.g. from redownload button on success screen)
    const sigP = tPenjaga || savedSigPenjaga || (sigPenjagaRef.current && !sigPenjagaRef.current.isEmpty() ? sigPenjagaRef.current.getCanvas().toDataURL('image/png') : '');
    const sigM = tMurid || savedSigMurid || (sigMuridRef.current && !sigMuridRef.current.isEmpty() ? sigMuridRef.current.getCanvas().toDataURL('image/png') : '');
    const logoBase64 = appLogo || await getLogoBase64();

    const tempRecord: BorangPenerimaan = {
      namaMurid: namaMurid.toUpperCase(),
      tahun,
      kelas: kelas.toUpperCase(),
      namaPenjaga: namaPenjaga.toUpperCase(),
      hubungan: hubungan as any,
      tarikhPenerimaan,
      bukuDiterima: JSON.stringify(Object.values(bukuState)),
      jumlahBukuDiterima: jumlahDiterima,
      statusLengkap: true,
      tandatanganPenjaga: sigP,
      tandatanganMurid: sigM
    };

    if (type === 'doc1' || type === 'both') {
      const doc1 = generateBorangAkuanPDF(tempRecord, undefined, logoBase64);
      doc1.save(`Borang_Akuan_${namaMurid.replace(/\s+/g, '_')}.pdf`);
    }
    if (type === 'doc2' || type === 'both') {
      const doc2 = generateRekodPerolehanPDF(tempRecord, undefined, logoBase64);
      doc2.save(`Rekod_Perolehan_${namaMurid.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setError('');
    setIsSubmitting(true);

    let tPenjaga = sigPenjagaRef.current?.isEmpty() ? '' : sigPenjagaRef.current?.getCanvas().toDataURL('image/png') || '';
    if (!tPenjaga && savedSigPenjaga) tPenjaga = savedSigPenjaga;
    
    let tMurid = sigMuridRef.current?.isEmpty() ? '' : sigMuridRef.current?.getCanvas().toDataURL('image/png') || '';
    if (!tMurid && savedSigMurid) tMurid = savedSigMurid;

    setSavedSigPenjaga(tPenjaga);
    setSavedSigMurid(tMurid);

    try {
      const payload: any = {
        namaMurid: namaMurid.toUpperCase(),
        tahun,
        kelas: kelas.toUpperCase(),
        namaPenjaga: namaPenjaga.toUpperCase(),
        hubungan,
        tarikhPenerimaan,
        bukuDiterima: JSON.stringify(Object.values(bukuState)),
        jumlahBukuDiterima: jumlahDiterima,
        statusLengkap: true,
        tandatanganPenjaga: tPenjaga,
        tandatanganMurid: tMurid
      };

      if (submittedDocId) {
        await updateDoc(doc(db, 'borang_penerimaan', submittedDocId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'borang_penerimaan'), payload);
        setSubmittedDocId(docRef.id);
      }

      setSuccess(true);
      
      // Auto download both documents on submit
      handleDownloadDocs('both', tPenjaga, tMurid);
      
    } catch (err: any) {
      console.error(err);
      setError('Ralat semasa menyimpan rekod. Sila cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md text-center border-t-4 border-blue-600">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Berjaya Dihantar!</h2>
        <p className="mb-6 text-gray-700">Terima kasih. Rekod anda telah berjaya disimpan dan dokumen PDF sedang dimuat turun.</p>
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center flex-wrap">
          <button onClick={() => window.location.reload()} className="px-4 py-2 mt-3 sm:mt-0 bg-blue-600 text-white rounded hover:bg-blue-700">
            Isi Borang Baru
          </button>
          <button onClick={() => setSuccess(false)} className="px-4 py-2 mt-3 sm:mt-0 bg-amber-100 text-amber-800 rounded hover:bg-amber-200">
            Edit Maklumat
          </button>
          <button onClick={() => handleDownloadDocs('doc1')} className="px-4 py-2 mt-3 sm:mt-0 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200">
            Muat Turun Borang Akuan
          </button>
          <button onClick={() => handleDownloadDocs('doc2')} className="px-4 py-2 mt-3 sm:mt-0 bg-green-100 text-green-800 rounded hover:bg-green-200">
            Muat Turun Borang No Perolehan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="text-center mb-8 border-b-2 border-blue-800 pb-6 flex flex-col items-center">
        <div className="w-28 h-28 mb-4 bg-white rounded-full flex items-center justify-center overflow-hidden border-4 border-blue-800 shadow-md">
          <img 
            src={appLogo || "/logo.png"} 
            alt="Logo SK Tudan" 
            className="w-full h-full object-cover" 
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "https://ui-avatars.com/api/?name=SKT&background=1e3a8a&color=fff&size=100";
            }} 
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 leading-tight">
          SISTEM PEREKODAN BUKU TEKS SPBT
        </h1>
        <h2 className="text-xl font-semibold text-gray-800 mt-2">SEKOLAH KEBANGSAAN TUDAN, MIRI</h2>
        <p className="mt-3 text-gray-600 text-sm">Borang Akuan Penerimaan Buku Teks Tahun 3 2026</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Bahagian 1 */}
        <section className="bg-blue-50/50 p-6 rounded-lg border border-blue-100">
          <h3 className="text-lg font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2">BAHAGIAN 1 – MAKLUMAT MURID</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Penuh Murid</label>
              <input type="text" list="student-names" value={namaMurid} onChange={handleNameChange} placeholder="Sila taip atau pilih nama murid..." className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase" />
              <datalist id="student-names">
                {STUDENTS_3_FLEKSIBEL.map((s, idx) => (
                  <option key={idx} value={s.nama} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tahun</label>
              <input type="text" value={tahun} disabled className="w-full p-2.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Kelas</label>
              <input type="text" value={kelas} onChange={e => setKelas(e.target.value)} placeholder="Cth: GEMILANG" className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Ibu / Bapa / Penjaga</label>
              <input type="text" value={namaPenjaga} onChange={e => setNamaPenjaga(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Hubungan</label>
              <select value={hubungan} onChange={e => setHubungan(e.target.value as any)} className="w-full p-2.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                <option value="">-- Sila Pilih --</option>
                <option value="Ibu">Ibu</option>
                <option value="Bapa">Bapa</option>
                <option value="Penjaga">Penjaga</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tarikh Penerimaan</label>
              <input type="text" value={tarikhPenerimaan} disabled className="w-full p-2.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
            </div>
          </div>
        </section>

        {/* Bahagian 2 */}
        <section>
          <h3 className="text-lg font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2">BAHAGIAN 2 – SENARAI BUKU TEKS</h3>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-yellow-800 font-medium">Sila tandakan buku yang diterima. Ruangan nombor perolehan WAJIB diisi bagi setiap buku yang ditandakan sebagai diterima. Bagi buku yang tidak diterima, sila pilih catatan (Belum diterima / Hilang) jika berkenaan.</p>
          </div>

          <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 border-b">Bil</th>
                  <th className="px-4 py-3 border-b min-w-[200px]">Judul Buku Teks</th>
                  <th className="px-4 py-3 border-b">Harga (RM)</th>
                  <th className="px-4 py-3 border-b text-center min-w-[100px]">Pilihan</th>
                  <th className="px-4 py-3 border-b min-w-[120px]">Keadaan</th>
                  <th className="px-4 py-3 border-b min-w-[140px]">No Perolehan</th>
                  <th className="px-4 py-3 border-b min-w-[165px]">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {SENARAI_BUKU.map((buku, idx) => {
                  const state = bukuState[buku.id];
                  const isChecked = state.diterima;
                  return (
                    <tr key={buku.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 border-b font-medium">{buku.bilangan}</td>
                      <td className="px-4 py-3 border-b">{buku.judul}</td>
                      <td className="px-4 py-3 border-b">{buku.harga.toFixed(2)}</td>
                      <td className="px-4 py-3 border-b text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => handleBukuChange(buku.id, 'diterima', e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </label>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select 
                          disabled={!isChecked}
                          value={state.keadaan}
                          onChange={(e) => handleBukuChange(buku.id, 'keadaan', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">--Pilih--</option>
                          <option value="Baik">Elok</option>
                          <option value="Rosak">Rosak</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 border-b">
                        <input 
                          type="text" 
                          disabled={!isChecked}
                          value={state.noPerolehan}
                          onChange={(e) => handleBukuChange(buku.id, 'noPerolehan', e.target.value)}
                          placeholder="Cth: 12345"
                          className="w-full p-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 uppercase"
                        />
                      </td>
                      <td className="px-4 py-3 border-b">
                        <select
                          value={state.catatan || ''}
                          onChange={(e) => handleBukuChange(buku.id, 'catatan', e.target.value)}
                          className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                            state.catatan === 'Hilang'
                              ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                              : state.catatan === 'Belum diterima'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 font-medium'
                                : 'border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <option value="">--Pilih--</option>
                          <option value="Belum diterima">Belum diterima</option>
                          <option value="Hilang">Hilang</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded text-center border border-blue-100">
            <p className="text-lg font-semibold text-blue-900">
              <span className="text-2xl">{jumlahDiterima}</span> daripada {SENARAI_BUKU.length} buah buku diterima.
            </p>
          </div>
        </section>

        {/* Bahagian 3 */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">BAHAGIAN 3 – AKUAN IBU BAPA/PENJAGA</h3>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <input 
                type="checkbox" 
                id="persetujuan" 
                checked={persetujuan}
                onChange={e => setPersetujuan(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="persetujuan" className="font-semibold text-gray-900 cursor-pointer leading-relaxed">
                Saya mengaku bahawa maklumat yang diberikan adalah benar. Saya telah menerima buku teks yang ditandakan dan bersetuju mematuhi semua peraturan Skim Pinjaman Buku Teks (SPBT).
              </label>
            </div>

            <div className="pl-8 pt-2">
              <p className="font-medium mb-2">Peraturan SPBT:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Membalut buku teks.</li>
                <li>Membawa buku teks ke sekolah mengikut jadual.</li>
                <li>Tidak meninggalkan buku teks merata-rata.</li>
                <li>Tidak menconteng atau merosakkan buku teks.</li>
                <li>Tidak menghilangkan buku teks.</li>
                <li>Memulangkan buku teks pada tarikh yang ditetapkan.</li>
                <li>Menggantikan atau membayar harga buku sekiranya buku hilang atau rosak akibat kecuaian.</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tandatangan Murid</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative">
                <SignatureCanvas 
                  ref={sigMuridRef}
                  canvasProps={{className: 'w-full h-40 rounded-lg touch-none'}}
                />
                <button type="button" onClick={() => { sigMuridRef.current?.clear(); setSavedSigMurid(''); }} className="absolute top-2 right-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded">Padam</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tandatangan Ibu/Bapa/Penjaga</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative">
                <SignatureCanvas 
                  ref={sigPenjagaRef}
                  canvasProps={{className: 'w-full h-40 rounded-lg touch-none'}}
                />
                <button type="button" onClick={() => { sigPenjagaRef.current?.clear(); setSavedSigPenjaga(''); }} className="absolute top-2 right-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded">Padam</button>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-6">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-lg shadow-md transition duration-200 disabled:opacity-70 flex justify-center items-center text-lg"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </span>
            ) : 'HANTAR DAN JANA DUA DOKUMEN'}
          </button>
        </div>
      </form>
    </div>
  );
}
