import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BorangPenerimaan, BukuDiterima, SENARAI_BUKU } from '../types';
import { generateBorangAkuanPDF, generateRekodPerolehanPDF, getLogoBase64 } from '../lib/pdf';
import { Search, Filter, Download, FileText, FileBarChart, LogOut, Save, Upload, Trash2, Pencil, X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

export default function TeacherDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [records, setRecords] = useState<(BorangPenerimaan & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  
  const [appLogo, setAppLogo] = useState<string>('');
  
  const [teacherSignature, setTeacherSignature] = useState<string>(() => localStorage.getItem('teacher_signature') || '');
  const [teacherName, setTeacherName] = useState<string>(() => localStorage.getItem('teacher_name') || '');
  const [teacherDate, setTeacherDate] = useState<string>(() => localStorage.getItem('teacher_date') || '');
  const [showSigPad, setShowSigPad] = useState(false);
  const teacherSigRef = React.useRef<SignatureCanvas>(null);

  const [editingRecord, setEditingRecord] = useState<(BorangPenerimaan & { id: string }) | null>(null);
  const [editFormData, setEditFormData] = useState({ namaMurid: '', kelas: '', namaPenjaga: '', hubungan: '' });
  const [editBukuState, setEditBukuState] = useState<Record<string, BukuDiterima>>({});
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const saveTeacherSignature = () => {
    if (teacherSigRef.current && !teacherSigRef.current.isEmpty()) {
      const dataUrl = teacherSigRef.current.getCanvas().toDataURL('image/png');
      localStorage.setItem('teacher_signature', dataUrl);
      setTeacherSignature(dataUrl);
    }
    localStorage.setItem('teacher_name', teacherName);
    localStorage.setItem('teacher_date', teacherDate);
    setShowSigPad(false);
  };

  const clearTeacherSignature = () => {
    if (teacherSigRef.current) teacherSigRef.current.clear();
  };

  const removeTeacherSignature = () => {
    localStorage.removeItem('teacher_signature');
    localStorage.removeItem('teacher_name');
    localStorage.removeItem('teacher_date');
    setTeacherSignature('');
    setTeacherName('');
    setTeacherDate('');
  };

  const TEACHER_PASSWORD = import.meta.env.VITE_TEACHER_PASSWORD || 'SPBT2026';

  useEffect(() => {
    if (!isAuthenticated) return;

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

    const q = query(collection(db, 'borang_penerimaan'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (BorangPenerimaan & { id: string })[];
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === TEACHER_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Kata laluan tidak sah');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };

  const handleDelete = (id: string) => {
    setRecordToDelete(id);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'borang_penerimaan', recordToDelete));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
      // Fallback error handling
      setRecordToDelete(null);
    }
  };

  const parseBukuList = (raw: string | BukuDiterima[]): BukuDiterima[] => {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw || [];
    } catch {
      return [];
    }
  };

  const getCatatanSummary = (raw: string | BukuDiterima[]) => {
    const list = parseBukuList(raw);
    const items: { judul: string; catatan: 'Belum diterima' | 'Hilang' }[] = [];
    SENARAI_BUKU.forEach(buku => {
      const found = list.find(b => b.idBuku === buku.id);
      if (found?.catatan === 'Belum diterima' || found?.catatan === 'Hilang') {
        items.push({ judul: buku.judul, catatan: found.catatan });
      }
    });
    return items;
  };

  const openEditModal = (record: BorangPenerimaan & { id: string }) => {
    setEditingRecord(record);
    setEditFormData({
      namaMurid: record.namaMurid,
      kelas: record.kelas,
      namaPenjaga: record.namaPenjaga,
      hubungan: record.hubungan
    });
    const list = parseBukuList(record.bukuDiterima);
    const map: Record<string, BukuDiterima> = {};
    SENARAI_BUKU.forEach(buku => {
      const existing = list.find(b => b.idBuku === buku.id);
      map[buku.id] = existing
        ? { ...existing, catatan: existing.catatan || '' }
        : { idBuku: buku.id, diterima: false, keadaan: '', noPerolehan: '', catatan: '' };
    });
    setEditBukuState(map);
  };

  const handleEditBukuCatatan = (idBuku: string, catatan: 'Belum diterima' | 'Hilang' | '') => {
    setEditBukuState(prev => {
      const current = prev[idBuku];
      const updated: BukuDiterima = {
        ...current,
        catatan,
      };
      if (catatan) {
        updated.diterima = false;
        updated.keadaan = '';
        updated.noPerolehan = '';
      }
      return { ...prev, [idBuku]: updated };
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    const updatedList = SENARAI_BUKU.map(b => editBukuState[b.id]);
    const updatedCount = updatedList.filter(b => b.diterima).length;

    try {
      await updateDoc(doc(db, 'borang_penerimaan', editingRecord.id), {
        namaMurid: editFormData.namaMurid.toUpperCase(),
        kelas: editFormData.kelas.toUpperCase(),
        namaPenjaga: editFormData.namaPenjaga.toUpperCase(),
        hubungan: editFormData.hubungan,
        bukuDiterima: JSON.stringify(updatedList),
        jumlahBukuDiterima: updatedCount
      });
      setEditingRecord(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Gagal mengemaskini rekod.");
    }
  };

  const filteredRecords = records.filter(record => {
    const matchName = record.namaMurid.toLowerCase().includes(searchTerm.toLowerCase());
    const matchKelas = filterKelas ? record.kelas === filterKelas : true;
    return matchName && matchKelas;
  });

  const uniqueKelas = Array.from(new Set(records.map(r => r.kelas))).sort();

  const handleExportCSV = () => {
    if (records.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Murid,Tahun,Kelas,Nama Penjaga,Hubungan,Tarikh,Jumlah Buku,Catatan\n";
    
    filteredRecords.forEach(row => {
      const catatanItems = getCatatanSummary(row.bukuDiterima);
      const catatanStr = catatanItems.length > 0
        ? catatanItems.map(i => `${i.judul} (${i.catatan})`).join('; ')
        : 'Tiada';
      const rowData = [
        `"${row.namaMurid}"`,
        row.tahun,
        `"${row.kelas}"`,
        `"${row.namaPenjaga}"`,
        row.hubungan,
        row.tarikhPenerimaan,
        row.jumlahBukuDiterima,
        `"${catatanStr.replace(/"/g, '""')}"`
      ];
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rekod_spbt_tudan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBorangAkuan = async (record: BorangPenerimaan) => {
    const logoBase64 = appLogo || await getLogoBase64();
    const doc1 = generateBorangAkuanPDF(record, teacherSignature, logoBase64, teacherName, teacherDate);
    doc1.save(`Borang_Akuan_${record.namaMurid.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadRekodPerolehan = async (record: BorangPenerimaan) => {
    const logoBase64 = appLogo || await getLogoBase64();
    const doc2 = generateRekodPerolehanPDF(record, teacherSignature, logoBase64, teacherName, teacherDate);
    doc2.save(`Rekod_Perolehan_${record.namaMurid.replace(/\s+/g, '_')}.pdf`);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setAppLogo(base64);
        try {
          await setDoc(doc(db, 'settings', 'system_logo'), { base64 });
        } catch (err) {
          console.error("Error saving logo:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = async () => {
    setAppLogo('');
    try {
      await setDoc(doc(db, 'settings', 'system_logo'), { base64: '' });
    } catch (err) {
      console.error("Error removing logo:", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-blue-900">Portal Guru</h2>
            <p className="text-gray-500 mt-2">Sila masukkan kata laluan untuk mengakses rekod.</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Kata Laluan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white p-3 rounded font-bold transition">
              Log Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto my-8 p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Dashboard Guru - Rekod SPBT</h1>
          <p className="text-gray-600">Jumlah Rekod: {filteredRecords.length}</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition">
            <Download size={16} /> Eksport CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium transition">
            <FileText size={16} /> Cetak
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded text-sm font-medium transition ml-auto">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari nama murid..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={18} className="text-gray-400" />
          </div>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="pl-10 w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
          >
            <option value="">Semua Kelas</option>
            {uniqueKelas.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Tetapan Logo Sekolah</h3>
          {appLogo ? (
            <div className="flex items-center gap-4">
              <div className="border border-gray-300 bg-white p-2 rounded">
                <img src={appLogo} alt="Logo Sekolah" className="h-16 w-16 object-cover rounded" />
              </div>
              <button onClick={removeLogo} className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1">
                <Trash2 size={16} /> Buang Logo
              </button>
            </div>
          ) : (
            <div>
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition inline-flex items-center gap-2">
                <Upload size={16} /> Muat Naik Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              <p className="text-xs text-gray-500 mt-2">Format disokong: PNG, JPG (Maks: 1MB)</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Tetapan Tandatangan Guru (Untuk Penjanaan PDF)</h3>
        {teacherSignature ? (
          <div className="flex items-center gap-4">
            <div className="border border-gray-300 bg-white p-2 rounded">
              <img src={teacherSignature} alt="Tandatangan Guru" className="h-16 object-contain" />
            </div>
            <button onClick={removeTeacherSignature} className="text-red-600 hover:text-red-800 text-sm font-medium">Buang & Set Semula</button>
          </div>
        ) : (
          <div>
            {!showSigPad ? (
              <button onClick={() => setShowSigPad(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition">
                + Tambah Tandatangan
              </button>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Guru Kelas</label>
                  <input type="text" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Contoh: AHMAD BIN ALI" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh Disahkan</label>
                  <input type="text" value={teacherDate} onChange={(e) => setTeacherDate(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="Contoh: 19 DISEMBER 2026" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tandatangan</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white relative mb-2">
                    <SignatureCanvas 
                      ref={teacherSigRef}
                      canvasProps={{className: 'w-full h-32 rounded-lg touch-none'}}
                    />
                    <button type="button" onClick={clearTeacherSignature} className="absolute top-2 right-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded">Padam</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveTeacherSignature} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition">
                    <Save size={16} /> Simpan
                  </button>
                  <button onClick={() => setShowSigPad(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded text-sm font-medium transition">
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuatkan rekod...</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Nama Murid</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Penjaga</th>
                <th className="px-4 py-3 text-center">Buku Diterima</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Tiada rekod dijumpai</td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const catatanItems = getCatatanSummary(record.bukuDiterima);
                  return (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{record.namaMurid}</td>
                    <td className="px-4 py-3">{record.kelas}</td>
                    <td className="px-4 py-3">{record.namaPenjaga} <span className="text-xs text-gray-500 block">({record.hubungan})</span></td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-bold">
                        {record.jumlahBukuDiterima} / {SENARAI_BUKU.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      {catatanItems.length === 0 ? (
                        <span className="text-xs text-gray-400">Tiada</span>
                      ) : (
                        <div className="space-y-1">
                          {catatanItems.map((item, i) => (
                            <div key={i} className="text-xs flex items-start gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                item.catatan === 'Hilang'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {item.catatan}
                              </span>
                              <span className="text-gray-700 truncate" title={item.judul}>{item.judul}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {record.statusLengkap ? (
                        <span className="text-green-600 font-semibold text-xs bg-green-50 px-2 py-1 rounded">Lengkap</span>
                      ) : (
                        <span className="text-red-600 font-semibold text-xs bg-red-50 px-2 py-1 rounded">Tidak Lengkap</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleDownloadBorangAkuan(record)}
                          className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded inline-flex items-center justify-center transition"
                          title="Muat Turun Borang Akuan (PDF)"
                        >
                          <FileText size={18} />
                        </button>
                        <button 
                          onClick={() => handleDownloadRekodPerolehan(record)}
                          className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-2 rounded inline-flex items-center justify-center transition"
                          title="Muat Turun Rekod No Perolehan (PDF)"
                        >
                          <FileBarChart size={18} />
                        </button>
                        <button 
                          onClick={() => openEditModal(record)}
                          className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 p-2 rounded inline-flex items-center justify-center transition"
                          title="Kemaskini Rekod"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded inline-flex items-center justify-center transition"
                          title="Padam Rekod"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Kemaskini Rekod</h3>
              <button onClick={() => setEditingRecord(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Murid</label>
                <input 
                  type="text" 
                  value={editFormData.namaMurid} 
                  onChange={(e) => setEditFormData({...editFormData, namaMurid: e.target.value})}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                <select 
                  value={editFormData.kelas} 
                  onChange={(e) => setEditFormData({...editFormData, kelas: e.target.value})}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 uppercase"
                  required
                >
                  <option value="">Pilih Kelas</option>
                  <option value="FLEKSIBEL">FLEKSIBEL</option>
                  <option value="DINAMIK">DINAMIK</option>
                  <option value="KREATIF">KREATIF</option>
                  <option value="INOVATIF">INOVATIF</option>
                  <option value="PROGRESIF">PROGRESIF</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penjaga</label>
                <input 
                  type="text" 
                  value={editFormData.namaPenjaga} 
                  onChange={(e) => setEditFormData({...editFormData, namaPenjaga: e.target.value})}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hubungan</label>
                <select 
                  value={editFormData.hubungan} 
                  onChange={(e) => setEditFormData({...editFormData, hubungan: e.target.value})}
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Pilih Hubungan</option>
                  <option value="Ibu">Ibu</option>
                  <option value="Bapa">Bapa</option>
                  <option value="Penjaga">Penjaga</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catatan Buku Teks</label>
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {SENARAI_BUKU.map((buku) => {
                    const state = editBukuState[buku.id];
                    return (
                      <div key={buku.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-800">{buku.bilangan}. {buku.judul}</span>
                          {state?.diterima && (
                            <span className="ml-2 text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                              Diterima ({state.noPerolehan || '-'})
                            </span>
                          )}
                        </div>
                        <select
                          value={state?.catatan || ''}
                          onChange={(e) => handleEditBukuCatatan(buku.id, e.target.value as any)}
                          className={`border rounded p-1.5 text-xs shrink-0 ${
                            state?.catatan === 'Hilang'
                              ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                              : state?.catatan === 'Belum diterima'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 font-medium'
                                : 'border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <option value="">--Pilih--</option>
                          <option value="Belum diterima">Belum diterima</option>
                          <option value="Hilang">Hilang</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Sahkan Pemadaman</h3>
            <p className="text-gray-600 mb-6">Adakah anda pasti mahu memadam rekod ini? Data yang dipadam tidak boleh dikembalikan.</p>
            <div className="flex justify-center space-x-3">
              <button 
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition"
              >
                Ya, Padam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
