export interface BukuTeks {
  id: string;
  bilangan: number;
  judul: string;
  harga: number;
}

export const SENARAI_BUKU: BukuTeks[] = [
  { id: 'b1', bilangan: 1, judul: 'BAHASA MELAYU JILID 1 SK (BT)', harga: 5.80 },
  { id: 'b2', bilangan: 2, judul: 'BAHASA MELAYU JILID 2 SK (BT)', harga: 5.80 },
  { id: 'b3', bilangan: 3, judul: 'GET SMART PLUS 3 SK (BT)', harga: 35.00 },
  { id: 'b4', bilangan: 4, judul: 'SCIENCE SK (TB)', harga: 9.00 },
  { id: 'b5', bilangan: 5, judul: 'MATHEMATICS PART 1 (TB)', harga: 7.40 },
  { id: 'b6', bilangan: 6, judul: 'MATHEMATICS PART 2 (TB)', harga: 7.40 },
  { id: 'b7', bilangan: 7, judul: 'PENDIDIKAN KESENIAN SK (BT)', harga: 5.90 },
  { id: 'b8', bilangan: 8, judul: 'PENDIDIKAN JASMANI DAN KESIHATAN SK (BT)', harga: 6.90 },
  { id: 'b9', bilangan: 9, judul: 'PENDIDIKAN MORAL SK (BT)', harga: 10.00 },
  { id: 'b10', bilangan: 10, judul: 'BAHASA IBAN SK (BT)', harga: 30.90 },
  { id: 'b11', bilangan: 11, judul: 'PENDIDIKAN ISLAM SK (BT)', harga: 9.50 },
  { id: 'b12', bilangan: 12, judul: 'BAHASA ARAB SK (BT)', harga: 8.10 },
  { id: 'b13', bilangan: 13, judul: 'AL-QURAN AL-KARIM BERTAJWID', harga: 38.00 },
  { id: 'b14', bilangan: 14, judul: 'WASPADA', harga: 2.50 },
];

export interface BukuDiterima {
  idBuku: string;
  diterima: boolean;
  keadaan: 'Baik' | 'Elok' | 'Rosak' | '';
  noPerolehan: string;
  catatan?: 'Belum diterima' | 'Hilang' | '';
}

export interface BorangPenerimaan {
  id?: string;
  namaMurid: string;
  tahun: string;
  kelas: string;
  namaPenjaga: string;
  hubungan: 'Ibu' | 'Bapa' | 'Penjaga' | '';
  tarikhPenerimaan: string;
  bukuDiterima: string; // JSON string of BukuDiterima[]
  jumlahBukuDiterima: number;
  statusLengkap: boolean;
  tandatanganPenjaga: string;
  tandatanganMurid: string;
  createdAt?: any;
}
