"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";
import { Button as MovingButton } from "@/components/ui/moving-border";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, MapPin } from "lucide-react";

interface HeroSectionProps {
  onArastirmayaBasla: () => void;
}

export function HeroSection({ onArastirmayaBasla }: HeroSectionProps) {
  return (
    <section className="relative flex w-full flex-col items-center justify-center overflow-hidden min-h-screen">
      <div className="absolute inset-0 z-0">
        <WebGLShader />
      </div> 
      
      <motion.div 
        className="relative z-10 w-full mx-auto max-w-5xl px-4"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative p-1 rounded-3xl bg-gradient-to-br from-gray-900/10 to-black/5 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-gray-900/20 via-gray-800/15 to-black/10 backdrop-blur-2xl rounded-3xl border border-gray-700/20 shadow-xl">
            
            <div className="text-center px-8 pt-12 pb-6">
              <motion.div
                className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <TrendingUp className="h-8 w-8 text-white" />
              </motion.div>
              
              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-300 mb-4 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Türkiye
                <span className="block text-4xl md:text-5xl lg:text-6xl mt-2">Yatırım Analizi</span>
              </motion.h1>
              
              <motion.p
                className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-3xl mx-auto font-semibold"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                81 ilin kapsamlı ekonomik verilerini analiz ederek yatırım fırsatlarını keşfedin. 
                Stratejik yatırım kararlarınızı detaylı istatistiksel analizlerle destekleyin.
              </motion.p>
            </div>
            
            <motion.div 
              className="px-8 py-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="group p-6 bg-gray-900/15 backdrop-blur-sm border border-gray-600/25 rounded-2xl hover:bg-gray-800/25 transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-100">81 İl Analizi</h3>
                      <p className="text-sm text-gray-300">Kapsamlı veri seti</p>
                    </div>
                  </div>
                </div>
                
                <div className="group p-6 bg-gray-900/15 backdrop-blur-sm border border-gray-600/25 rounded-2xl hover:bg-gray-800/25 transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                      <MapPin className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-100">Coğrafi Görselleştirme</h3>
                      <p className="text-sm text-gray-300">İnteraktif harita</p>
                    </div>
                  </div>
                </div>
                
                <div className="group p-6 bg-gray-900/15 backdrop-blur-sm border border-gray-600/25 rounded-2xl hover:bg-gray-800/25 transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-100">İstatistiksel Analiz</h3>
                      <p className="text-sm text-gray-300">Veri tabanlı öngörü</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <motion.div 
                  className="flex items-center gap-3 px-4 py-2 bg-emerald-500/15 border border-emerald-400/30 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.9 }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-medium text-emerald-200">Güncel verilerle hazır</span>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.1 }}
                >
                  <InteractiveHoverButton
                    text="Başla"
                    onClick={onArastirmayaBasla}
                    className="w-48 h-14 bg-slate-900/90 border-slate-700 text-white font-bold text-lg hover:scale-105 transition-transform duration-300"
                  />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}