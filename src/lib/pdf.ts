import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BorangPenerimaan, BukuDiterima, SENARAI_BUKU } from '../types';

export const getLogoBase64 = async (): Promise<string | null> => {
  try {
    const response = await fetch('/logo.png');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return null;
  }
};

export const generateBorangAkuanPDF = (record: BorangPenerimaan, teacherSignature?: string, logoBase64?: string | null, teacherName?: string, teacherDate?: string) => {
  const doc = new jsPDF();
  const bukuState = typeof record.bukuDiterima === 'string' ? JSON.parse(record.bukuDiterima) as BukuDiterima[] : record.bukuDiterima;
  
  // Draw Logo if available
  if (logoBase64) {
    try {
      // 20x20 dimensions at top left (14, 8)
      doc.addImage(logoBase64, 'PNG', 14, 8, 20, 20);
    } catch (e) {
      // Ignore if image fails
    }
  }

  // Header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SEKOLAH KEBANGSAAN TUDAN, MIRI', 105, 15, { align: 'center' });
  doc.text('BORANG AKUAN PENERIMAAN BUKU TEKS TAHUN 3 2026', 105, 21, { align: 'center' });
  
  // Student Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`NAMA MURID :  ${record.namaMurid}`, 14, 32);
  doc.text(`TAHUN :  3 ${record.kelas}`, 140, 32);
  
  // Table Data
  const tableBody = SENARAI_BUKU.map((buku) => {
    const state = bukuState.find((b: BukuDiterima) => b.idBuku === buku.id);
    const terima = state?.diterima ? '/' : (state?.catatan ? 'X' : '');
    const keadaan = state?.diterima ? (state.keadaan === 'Baik' || state.keadaan === 'Elok' ? '/' : 'X') : '';
    const catatan = state?.catatan || '';
    return [
      buku.bilangan,
      buku.judul,
      buku.harga.toFixed(2),
      terima,
      keadaan,
      catatan
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['BIL', 'JUDUL BUKU TEKS', 'HARGA\n(RM)', 'ADA TERIMA BUKU ( / )\nBELUM TERIMA BUKU ( X )', 'TANDA/CATAT SAMA ADA\nELOK ( / )\nROSAK ( X )\nSEMASA PENERIMAAN', 'CATATAN']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle', fontSize: 7.5 },
    bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 7.5, textColor: [0, 0, 0], valign: 'middle', cellPadding: 1.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 38 },
      5: { halign: 'center', cellWidth: 30 }
    },
    margin: { left: 14, right: 14 }
  });

  // Rules Text
  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  
  doc.text(`Saya  ${record.namaMurid}  dengan ini mengakui telah menerima sejumlah`, 14, y);
  y += 5;
  doc.text(`  ${record.jumlahBukuDiterima}  naskhah buku teks SPBT seperti mana berikut:`, 14, y);
  
  y += 8;
  
  const rules = [
    '2.      Saya memahami bahawa semua buku teks tersebut adalah hak Kerajaan Malaysia yang dipinjamkan',
    '        kepada saya/anak/tanggungan saya tertakluk kepada peraturan Skim Pinjaman Buku Teks Sekolah.',
    '',
    '3.      Dengan ini saya berjanji akan menjaga buku teks dengan baik dan mematuhi peraturan-peraturan SPBT',
    '        seperti berikut:',
    '           3.1   Membalut buku teks                                              3.4   Tidak menconteng atau merosakkan buku teks.',
    '           3.2   Membawa buku teks ke sekolah                            3.5   Tidak menghilangkan buku teks.',
    '           3.3   Tidak meninggalkan buku teks di merata-rata      3.6   Memulangkan buku teks pada waktunya dengan',
    '                   tempat.                                                               jumlah yang mencukupi.',
    '',
    '4.      Kegagalan saya/anak/tanggungan saya mematuhi peraturan SPBT, pihak sekolah boleh mengambil apa-',
    '        apa tindakan yang sesuai terhadap saya/anak/tanggungan saya.'
  ];

  rules.forEach(line => {
    doc.text(line, 14, y);
    y += 4.5;
  });

  y += 5;
  
  // Signatures Layout
  
  // Left 1: Penerima (Murid)
  doc.text('Yang benar,', 14, y);
  
  if (record.tandatanganMurid) {
    doc.addImage(record.tandatanganMurid, 'PNG', 14, y + 2, 35, 15);
  }
  
  // Right 1: Guru
  doc.text('Disahkan oleh Guru Kelas,', 120, y);
  if (teacherSignature) {
    doc.addImage(teacherSignature, 'PNG', 120, y + 2, 35, 15);
  }
  
  y += 13;
  doc.text('......................................................', 14, y);
  doc.text('Tandatangan penerima', 14, y + 5);
  doc.text(`Tarikh : ${record.tarikhPenerimaan}`, 14, y + 10);

  doc.text(teacherName ? `(  ${teacherName}  )` : '(                                             )', 120, y);
  doc.text(`Tarikh : ${teacherDate ? teacherDate : '....................................'}`, 120, y + 10);
  
  y += 13;
  
  // Left 2: Penjaga
  doc.text('Diakui oleh:', 14, y);
  if (record.tandatanganPenjaga) {
    doc.addImage(record.tandatanganPenjaga, 'PNG', 14, y + 2, 35, 15);
  }
  
  y += 13;
  doc.text(`(  ${record.namaPenjaga}  )`, 14, y);
  doc.text('Tandatangan Ibu/Bapa/Penjaga', 14, y + 5);
  doc.text(`Tarikh : ${record.tarikhPenerimaan}`, 14, y + 10);

  return doc;
};


export const generateRekodPerolehanPDF = (record: BorangPenerimaan, teacherSignature?: string, logoBase64?: string | null, teacherName?: string, teacherDate?: string) => {
  const doc = new jsPDF();
  const bukuState = typeof record.bukuDiterima === 'string' ? JSON.parse(record.bukuDiterima) as BukuDiterima[] : record.bukuDiterima;
  
  // Draw Logo if available
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 20, 20);
    } catch (e) {
      // Ignore if image fails
    }
  }

  // Header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SEKOLAH KEBANGSAAN TUDAN, MIRI', 105, 15, { align: 'center' });
  doc.text('REKOD NOMBOR PEROLEHAN BUKU TEKS TAHUN 3 2026', 105, 21, { align: 'center' });
  
  // Student Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`NAMA MURID :  ${record.namaMurid}`, 14, 32);
  doc.text(`TAHUN :  3 ${record.kelas}`, 140, 32);
  
  // Table Data
  const tableBody = SENARAI_BUKU.map((buku) => {
    const state = bukuState.find((b: BukuDiterima) => b.idBuku === buku.id);
    const terima = state?.diterima ? '/' : (state?.catatan ? 'X' : '');
    const keadaan = state?.diterima ? (state.keadaan === 'Baik' || state.keadaan === 'Elok' ? '/' : 'X') : '';
    const noPerolehan = state?.diterima ? state.noPerolehan : '-';
    const catatan = state?.catatan || '';
    
    return [
      buku.bilangan,
      buku.judul,
      buku.harga.toFixed(2),
      noPerolehan,
      terima,
      keadaan,
      catatan
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [['BIL', 'JUDUL BUKU TEKS', 'HARGA\n(RM)', 'NO PEROLEHAN', 'TERIMA ( / )', 'ELOK ( / )\nROSAK ( X )', 'CATATAN']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle', fontSize: 7.5 },
    bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, fontSize: 7.5, textColor: [0, 0, 0], valign: 'middle', cellPadding: 1.5 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center', cellWidth: 30 }
    },
    margin: { left: 14, right: 14 }
  });

  // Rules Text
  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  
  doc.text(`Saya  ${record.namaMurid}  dengan ini mengakui telah menerima sejumlah`, 14, y);
  y += 5;
  doc.text(`  ${record.jumlahBukuDiterima}  naskhah buku teks SPBT seperti mana berikut:`, 14, y);
  
  y += 8;
  
  const rules = [
    '2.      Saya memahami bahawa semua buku teks tersebut adalah hak Kerajaan Malaysia yang dipinjamkan',
    '        kepada saya/anak/tanggungan saya tertakluk kepada peraturan Skim Pinjaman Buku Teks Sekolah.',
    '',
    '3.      Dengan ini saya berjanji akan menjaga buku teks dengan baik dan mematuhi peraturan-peraturan SPBT',
    '        seperti berikut:',
    '           3.1   Membalut buku teks                                              3.4   Tidak menconteng atau merosakkan buku teks.',
    '           3.2   Membawa buku teks ke sekolah                            3.5   Tidak menghilangkan buku teks.',
    '           3.3   Tidak meninggalkan buku teks di merata-rata      3.6   Memulangkan buku teks pada waktunya dengan',
    '                   tempat.                                                               jumlah yang mencukupi.',
    '',
    '4.      Kegagalan saya/anak/tanggungan saya mematuhi peraturan SPBT, pihak sekolah boleh mengambil apa-',
    '        apa tindakan yang sesuai terhadap saya/anak/tanggungan saya.'
  ];

  rules.forEach(line => {
    doc.text(line, 14, y);
    y += 4.5;
  });

  y += 5;
  
  // Signatures Layout
  
  // Left 1: Penerima (Murid)
  doc.text('Yang benar,', 14, y);
  
  if (record.tandatanganMurid) {
    doc.addImage(record.tandatanganMurid, 'PNG', 14, y + 2, 35, 15);
  }
  
  // Right 1: Guru
  doc.text('Disahkan oleh Guru Kelas,', 120, y);
  if (teacherSignature) {
    doc.addImage(teacherSignature, 'PNG', 120, y + 2, 35, 15);
  }
  
  y += 13;
  doc.text('......................................................', 14, y);
  doc.text('Tandatangan penerima', 14, y + 5);
  doc.text(`Tarikh : ${record.tarikhPenerimaan}`, 14, y + 10);

  doc.text(teacherName ? `(  ${teacherName}  )` : '(                                             )', 120, y);
  doc.text(`Tarikh : ${teacherDate ? teacherDate : '....................................'}`, 120, y + 10);
  
  y += 13;
  
  // Left 2: Penjaga
  doc.text('Diakui oleh:', 14, y);
  if (record.tandatanganPenjaga) {
    doc.addImage(record.tandatanganPenjaga, 'PNG', 14, y + 2, 35, 15);
  }
  
  y += 13;
  doc.text(`(  ${record.namaPenjaga}  )`, 14, y);
  doc.text('Tandatangan Ibu/Bapa/Penjaga', 14, y + 5);
  doc.text(`Tarikh : ${record.tarikhPenerimaan}`, 14, y + 10);

  return doc;
};
