import { useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion } from "framer-motion";
import Encoder from "./components/Encoder";
import Decoder from "./components/Decoder";

function App() {
  const [activeTab, setActiveTab] = useState<"encode" | "decode">("encode");

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-gray-900 text-white p-4 md:p-8">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss={false} draggable pauseOnHover theme="dark" />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="container mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400"
          >
            StegLock
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }} className="text-lg text-blue-100/80">
            Penyisipan dan Ekstraksi Pesan dengan Geo Location
          </motion.p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden">
          <div className="flex border-b border-slate-700/70">
            <button
              onClick={() => setActiveTab("encode")}
              className={`flex-1 py-5 font-medium text-lg transition-all duration-300 ${activeTab === "encode" ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/90" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"}`}
            >
              Penyisipan Pesan
            </button>
            <button
              onClick={() => setActiveTab("decode")}
              className={`flex-1 py-5 font-medium text-lg transition-all duration-300 ${activeTab === "decode" ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/90" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"}`}
            >
              Ekstraksi Pesan
            </button>
          </div>

          <div className="p-6 md:p-8">{activeTab === "encode" ? <Encoder /> : <Decoder />}</div>
        </div>
        <h2 className="text-xl font-semibold mb-4 text-blue-300">Tentang Algoritma Steganografi PVD</h2>
        <div className="space-y-2">
          <h3 className="font-semibold text-blue-200">Pixel Value Differencing (PVD)</h3>
          <p className="text-slate-300 text-sm">
            Algoritma PVD menggunakan perbedaan nilai antara pixel berdekatan untuk menyembunyikan pesan. Kapasitas embedding secara otomatis menyesuaikan dengan kompleksitas area gambar, memberikan hasil yang optimal dan sulit dideteksi.
          </p>
          <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">
            <li>Kapasitas adaptif: area smooth = kapasitas rendah, area tekstur = kapasitas tinggi</li>
            <li>Terintegrasi dengan sistem kunci lokasi geografis yang deterministik</li>
            <li>Menggunakan 7 tingkat kapasitas berbeda berdasarkan perbedaan pixel</li>
            <li>Lebih sulit dideteksi dibanding metode LSB tradisional</li>
            <li>Preservasi kualitas visual yang superior dengan distorsi minimal</li>
            <li>Built-in header validation untuk memastikan kunci lokasi yang benar</li>
          </ul>
        </div>
        <div className="mt-6">
          <h3 className="font-semibold text-blue-200">Berbasis Lokasi Geografis</h3>
          <p className="text-slate-300 text-sm">Sistem ini menggunakan fitur geolokasi untuk menghasilkan kunci lokasi berdasarkan posisi fisik. Pesan hanya dapat dibuka ketika pengguna berada dalam radius lokasi yang ditentukan.</p>
          <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1 mt-2">
            <li>Tambahkan keamanan berbasis lokasi geografis</li>
            <li>Simpan lokasi dengan radius tertentu sebagai parameter kunci</li>
            <li>Pesan hanya dapat dibuka saat berada di lokasi yang sama</li>
            <li>Ideal untuk berbagi pesan yang terikat dengan lokasi tertentu</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
