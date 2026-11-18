import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Users,
  Calendar,
  Layers,
  Monitor,
  Smartphone,
  Tablet,
  Star,
  ArrowRight,
  LogIn,
  UserPlus,
  Menu,
  X,
  Zap,
  BarChart3,
  Package,
  Receipt,
  Store,
  Clock,
  Headphones
} from 'lucide-react';
import { AppSettings } from '../types';

interface LandingPageProps {
  onLoginClick: () => void;
  onStartTrialClick: () => void;
  settings?: AppSettings;
}

export function LandingPage({ onLoginClick, onStartTrialClick, settings }: LandingPageProps) {
  // Mobile Nav Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero Slider State (Continuous auto-switching between the 2 mockups)
  const slides = [
    {
      image: '/landing/hero1.jpg',
      badge: 'الصالونات النسائية ومراكز التجميل والميكب',
      tagline: 'تجربة حجز ونقاط بيع راقية تناسب عملائك المميزين'
    },
    {
      image: '/landing/hero2.jpg',
      badge: 'صالونات الحلاقة الرجالية ومراكز العناية الفاخرة',
      tagline: 'إدارة متكاملة لفرق العمل، الكراسي، والورديات بكل سهولة'
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);

  // Auto-play slider every 4.5 seconds
  useEffect(() => {
    if (isSliderPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length, isSliderPaused]);

  // Pricing State: Monthly vs Annual (Annual offers 2 months free)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');

  // Contact Information
  const contactPhone = '+201014889704';
  const whatsappUrl = `https://wa.me/201014889704?text=${encodeURIComponent(
    'مرحباً، أود الاستفسار عن منظومة سمارت كت برو (Smart Cut Pro) وبدء التجربة المجانية.'
  )}`;

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* ========================================================
          1. HEADER / NAVBAR
         ======================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/30">
              <Scissors size={22} className="transform -rotate-12" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight">سمارت كت برو</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 hidden sm:inline-block">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">المنظومة السحابية الذكية للصالونات</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              الرئيسية
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              مزايا البرنامج
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-sm font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              الأسعار والباقات
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-sm font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              تواصل معنا
            </button>
          </nav>

          {/* Action Buttons (Desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={onLoginClick}
              className="h-10 px-4 text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogIn size={15} />
              <span>تسجيل دخول</span>
            </button>

            <button
              type="button"
              onClick={onStartTrialClick}
              className="h-10 px-4 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Sparkles size={15} className="text-emerald-950" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
            aria-label="قائمة الموقع"
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-white/10 px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="block w-full text-right py-2 text-sm font-bold text-slate-200 hover:text-emerald-400 border-b border-slate-800"
            >
              الرئيسية
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-200 hover:text-emerald-400 border-b border-slate-800"
            >
              مزايا البرنامج
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-200 hover:text-emerald-400 border-b border-slate-800"
            >
              الأسعار والباقات
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-200 hover:text-emerald-400 border-b border-slate-800"
            >
              تواصل معنا
            </button>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onStartTrialClick(); }}
                className="w-full py-3 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Sparkles size={16} />
                <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onLoginClick(); }}
                className="w-full py-2.5 text-xs font-bold text-slate-200 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2"
              >
                <LogIn size={15} />
                <span>تسجيل دخول</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================
          2. HERO SECTION WITH CONTINUOUS SLIDER
         ======================================================== */}
      <section
        className="relative min-h-[92vh] lg:min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden"
        onMouseEnter={() => setIsSliderPaused(true)}
        onMouseLeave={() => setIsSliderPaused(false)}
      >
        {/* Background Auto-Slider Images */}
        <div className="absolute inset-0 z-0">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              } transition-transform duration-[6000ms]`}
            >
              <img
                src={slide.image}
                alt={`Smart Cut Pro Presentation ${idx + 1}`}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}

          {/* Dark Overlay with Gradient for Razor-sharp White Typography */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/55 backdrop-blur-[2px]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.6)_100%)]"></div>
        </div>

        {/* Hero Slider Prev/Next Controls */}
        <button
          type="button"
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white border border-white/15 backdrop-blur-md hidden md:flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105"
          aria-label="الصورة السابقة"
        >
          <ChevronRight size={22} />
        </button>
        <button
          type="button"
          onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white border border-white/15 backdrop-blur-md hidden md:flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105"
          aria-label="الصورة التالية"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Active Slide Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold backdrop-blur-md shadow-inner animate-pulse">
            <Sparkles size={14} className="text-emerald-400" />
            <span>{slides[currentSlide].badge}</span>
          </div>

          {/* Main Title (White) */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight drop-shadow-md">
            سمارت كت برو
          </h1>

          {/* Subtitle (White) */}
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white/95 tracking-wide drop-shadow-sm">
            النظام المتخصص لإدارة صالونات التجميل
          </h2>

          {/* Powerful Description / Value Offer */}
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-200/90 font-medium leading-relaxed drop-shadow-xs">
            المنظومة السحابية الذكية المتكاملة لنقاط البيع السريعة، تنظيم الحجوزات والمواعيد، 
            حساب عمولات ومسير رواتب الموظفين بدقة متناهية، وإدارة المخزون والورديات بكل سهولة واحترافية من أي جهاز.
          </p>

          {/* Two Prominent Action Buttons on Hero */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={onStartTrialClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-1 active:scale-95 whitespace-nowrap group shrink-0"
            >
              <Sparkles size={18} className="text-slate-950 group-hover:rotate-12 transition-transform shrink-0" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>

            <button
              type="button"
              onClick={onLoginClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-bold text-white bg-slate-900/80 hover:bg-slate-900 border border-white/20 hover:border-white/40 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <LogIn size={18} className="text-slate-200 shrink-0" />
              <span>تسجيل الدخول</span>
            </button>
          </div>

          {/* Mini Trust Highlights */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-slate-300/80">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>تفعيل فوري مجاني 7 أيام</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>بدون بطاقة ائتمانية</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>كمبيوتر • تابلت • جوال</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>دعم فني وتدريب مجاني</span>
            </span>
          </div>

          {/* Slider Dots Indicator */}
          <div className="pt-4 flex items-center justify-center gap-2.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === currentSlide ? 'w-8 bg-emerald-400 shadow-md shadow-emerald-400/50' : 'w-2.5 bg-white/30 hover:bg-white/60'
                }`}
                aria-label={`شريحة رقم ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          3. STATS & TRUST RIBBON
         ======================================================== */}
      <section className="relative z-20 -mt-6 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">+500</p>
            <p className="text-xs sm:text-sm font-bold text-slate-300">صالون ومركز تجميل</p>
          </div>
          <div className="space-y-1 border-r border-slate-800">
            <p className="text-3xl sm:text-4xl font-black text-teal-400 font-mono">+1,000,000</p>
            <p className="text-xs sm:text-sm font-bold text-slate-300">فاتورة وحجز منجز</p>
          </div>
          <div className="space-y-1 border-r-0 md:border-r border-slate-800">
            <p className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">99.9%</p>
            <p className="text-xs sm:text-sm font-bold text-slate-300">استقرار سحابي وأمان</p>
          </div>
          <div className="space-y-1 border-r border-slate-800">
            <p className="text-3xl sm:text-4xl font-black text-sky-400 font-mono">24/7</p>
            <p className="text-xs sm:text-sm font-bold text-slate-300">دعم فني وتحديثات</p>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. FEATURES SECTION (مزايا البرنامج - بدون إسهاب)
         ======================================================== */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <Zap size={14} />
            <span>مزايا النظام الأساسية</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            كل ما يحتاجه صالونك في مكان واحد وبدون تعقيد
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
            صُمم سمارت كت برو بأحدث المعايير البرمجية ليمنحك تحكماً شاملاً وسريعاً في جميع تفاصيل الصالون التشغيلية والمالية.
          </p>
        </div>

        {/* 8 Concise Feature Cards with Visual Icons & Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-emerald-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <Receipt size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">نقاط بيع سريعة (POS)</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              إصدار فواتير وسندات بلمسة واحدة، دعم الدفع النقدي والشبكة والمختلط، وطباعة حرارية سريعة متوافقة مع كل الطابعات.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-teal-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">جدول حجوزات ومواعيد ذكي</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              تنظيم مواعيد العملاء والميكب آرتست، تتبع واستلام العربون، منع التضارب، وتنبيهات فورية للحضور والمواعيد.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-amber-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">عمولات الموظفين والرواتب</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              احتساب آلي دقيق لعمولات الخدمات والمنتجات، متابعة السلف والمكافآت والخصومات بضغطة زر وبدون أي أخطاء حسابية.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">المخزون واستهلاك الخامات</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              خصم كميات الخامات ومستلزمات العناية تلقائياً مع كل خدمة، جرد سريع للمستودع، وتنبيهات ذكية عند نقص المخزون.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-rose-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 group-hover:scale-110 transition-transform">
              <Layers size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">ضبط الخزائن والورديات</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              مطابقة عهدة الكاشير الصباحية والمسائية، تقفيل وردية إلكتروني آمن، ومنع التلاعب النقدي وحساب العجز والزيادة.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-sky-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-5 group-hover:scale-110 transition-transform">
              <Monitor size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">شاشات الانتظار وبوابات الخدمة</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              شاشة نداء مرئية وصوتية للعملاء، كيوسك حجز ذاتي، وبوابات مستقلة لخبيرات التجميل والموظفين لمتابعة أدائهم.
            </p>
          </div>

          {/* Feature 7 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-purple-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">تقارير الأرباح والتحليلات</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              لوحة تحكم تنفيذية توضح صافي أرباح الصالون، الإيرادات اليومية، مصروفات التشغيل، وأكثر الخدمات طلباً في لحظات.
            </p>
          </div>

          {/* Feature 8 */}
          <div className="bg-slate-900/70 hover:bg-slate-900 border border-white/10 hover:border-emerald-500/40 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-lg group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <Store size={24} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">سحابي ومتعدد الفروع</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              تابع كافة فروع صالونك من شاشة واحدة أينما كنت، مع نظام صلاحيات أمان محكم لكل موظف ومدير فرع.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. CROSS-DEVICE SHOWCASE (يعمل على كافة الأجهزة)
         ======================================================== */}
      <section className="py-16 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-bold">
                <Tablet size={14} />
                <span>توافق تام وعمل فوري</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                يعمل بسلاسة على شاشات الكاشير، التابلت، والجوال
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">
                لا حاجة لشراء أجهزة باهظة الثمن! سمارت كت برو يعمل مباشرة عبر المتصفح أو كتطبيق على أجهزة الكمبيوتر، الشاشات اللمسية، أجهزة الآيباد والتابلت، وهواتف الأندرويد والآيفون.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">شاشات نقاط البيع والكاشير المكتبي</p>
                    <p className="text-xs text-slate-400">لإصدار الفواتير وطباعة الإيصالات والتحكم الكامل</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                    <Tablet size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">أجهزة التابلت والآيباد داخل الصالون</p>
                    <p className="text-xs text-slate-400">لشاشات الكيوسك الذاتي وجداول حجوزات الاستقبال</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">الهواتف الذكية للمالك والموظفين</p>
                    <p className="text-xs text-slate-400">لمتابعة الأرباح والتقارير الفورية لحظة بلحظة من أي مكان</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Showcase Visual Container */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-2xl group">
                <img
                  src="/landing/hero1.jpg"
                  alt="Smart Cut Pro across devices"
                  className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 right-4 left-4 p-4 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">واجهة عربية أنيقة وسهلة التعلم</p>
                      <p className="text-[11px] text-slate-400">فريقك سيبدأ العمل في دقائق دون تعقيدات تدريب</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onStartTrialClick}
                    className="px-4 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    جرب الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. PRICING SECTION (الأسعار - باقات الاشتراكات)
         ======================================================== */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <Star size={14} />
            <span>خطط وأسعار شفافة</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            باقات اشتراك تناسب حجم صالونك وطموحه
          </h2>
          <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
            اختر الباقة المناسبة لفريق عملك، وابدأ تجربتك المجانية لمدة 7 أيام كاملة الميزات بدون أي التزام مسبق.
          </p>

          {/* Currency & Period Switchers */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            {/* Billing Period Toggle */}
            <div className="bg-slate-900 border border-white/15 p-1 rounded-2xl inline-flex items-center">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  billingPeriod === 'monthly' ? 'bg-emerald-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                دفع شهري
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  billingPeriod === 'annual' ? 'bg-emerald-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>دفع سنوي</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-md font-black">
                  وفر شهرين
                </span>
              </button>
            </div>

            {/* Currency Toggle */}
            <div className="bg-slate-900 border border-white/15 p-1 rounded-2xl inline-flex items-center">
              <button
                type="button"
                onClick={() => setCurrency('EGP')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  currency === 'EGP' ? 'bg-white/15 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                جنيه مصري (EGP)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  currency === 'USD' ? 'bg-white/15 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                دولار أمريكي (USD)
              </button>
            </div>
          </div>
        </div>

        {/* 3 Subscription Plan Cards (المقسمة سابقاً في المنظومة) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1: Starter */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-xl transition-all hover:border-white/20">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  1 إلى 5 موظفين
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">باقة البداية</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                مثالية للصالونات الناشئة والصغيرة التي تبحث عن نظام فواتير وحجوزات سريع ومنظم.
              </p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">
                    {currency === 'EGP'
                      ? billingPeriod === 'monthly' ? '350' : '3,500'
                      : billingPeriod === 'monthly' ? '13' : '130'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                  </span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-[11px] text-emerald-400 font-bold mt-1">توفير شهرين مجاناً عند السداد السنوي</p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 text-xs text-slate-300 font-medium">
                <p className="font-bold text-white text-xs mb-2">تشمل الميزات التالية:</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>فريق عمل حتى 5 موظفين</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>نقاط البيع السريعة وفواتير غير محدودة</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>جدول الحجوزات والمواعيد التفاعلي</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>إدارة الخدمات والأسعار وقائمة العناية</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>إدارة الخزينة والورديات اليومية</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>دعم فرع واحد وربط الأجهزة المحلية</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={onStartTrialClick}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xs transition-all border border-white/20 hover:border-white/30 cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>ابدأ تجربة 7 أيام مجاناً</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Plan 2: Growth (Popular) */}
          <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500 rounded-3xl p-8 flex flex-col justify-between shadow-2xl shadow-emerald-500/10 transform lg:-translate-y-3">
            {/* Popular Badge */}
            <div className="absolute -top-3.5 right-1/2 translate-x-1/2 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-xs font-black px-4 py-1 rounded-full shadow-lg flex items-center gap-1.5">
              <Sparkles size={13} />
              <span>الأكثر طلباً واختياراً</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 pt-1">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  6 إلى 10 موظفين
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">باقة التوسع</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                الخيار المثالي للصالونات النشطة التي تحتاج لحساب العمولات والمخازن وبرامج الولاء.
              </p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-emerald-400 font-mono">
                    {currency === 'EGP'
                      ? billingPeriod === 'monthly' ? '450' : '4,500'
                      : billingPeriod === 'monthly' ? '17' : '160'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                  </span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-[11px] text-emerald-400 font-bold mt-1">وفر شهرين مجاناً عند الاشتراك السنوي</p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 text-xs text-slate-200 font-medium">
                <p className="font-bold text-white text-xs mb-2">كافة ميزات باقة البداية، بالإضافة إلى:</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>فريق عمل من 6 إلى 10 موظفين</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>إدارة المخازن والمستودع وحركة استهلاك الخامات</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>حساب عمولات الموظفين والسلف والمسير الذكي</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>برنامج ولاء ونقاط العملاء وكوبونات الخصم</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>إشعارات تذكير المواعيد وربط رسائل واتساب</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>تقارير مالية تفصيلية ومقارنات دورية</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={onStartTrialClick}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:scale-95"
              >
                <Sparkles size={16} />
                <span>ابدأ تجربة 7 أيام مجاناً</span>
              </button>
            </div>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-xl transition-all hover:border-white/20">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  أكثر من 10 موظفين
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">باقة الأعمال الكبرى</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                الحل الشامل واللامحدود للمراكز الكبرى والمنشآت المتعددة الفروع مع كامل الصلاحيات.
              </p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white font-mono">
                    {currency === 'EGP'
                      ? billingPeriod === 'monthly' ? '550' : '5,500'
                      : billingPeriod === 'monthly' ? '27' : '264'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                  </span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-[11px] text-emerald-400 font-bold mt-1">توفير شهرين مجاناً عند السداد السنوي</p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 text-xs text-slate-300 font-medium">
                <p className="font-bold text-white text-xs mb-2">كافة ميزات باقة التوسع، بالإضافة إلى:</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>عدد موظفين غير محدود (11+ موظف)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>دعم كامل للفروع المتعددة والمزامنة المركزية</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>شاشة نداء العملاء بالصوت (Queue Calling)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>شاشات كيوسك الخدمة الذاتية للعملاء</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>بوابة خاصة للموظفين لمتابعة مستحقاتهم</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>أولوية قصوى وتدريب مخصص في الدعم الفني</span>
                </div>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={onStartTrialClick}
                className="w-full py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xs transition-all border border-white/20 hover:border-white/30 cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>ابدأ تجربة 7 أيام مجاناً</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Note on Additional Branches */}
        <div className="mt-12 text-center">
          <p className="text-xs text-slate-400 font-medium">
            هل تمتلك فروعاً إضافية؟ يتم ترخيص كل فرع إضافي بتكلفة مخفضة (تبدأ من 250 ج.م شهرياً) مع ربط موحد لكافة التقارير.
          </p>
        </div>
      </section>

      {/* ========================================================
          7. BOTTOM CTA SECTION
         ======================================================== */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-y border-emerald-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-xs font-bold">
            <Sparkles size={14} />
            <span>ابدأ الآن خلال دقيقة واحدة</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            جاهز لنقل صالونك إلى مستوى جديد من التميز والأرباح؟
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
            انضم إلى المئات من أصحاب الصالونات الناجحة واستفد من فترة التجربة المجانية الكاملة لـ 7 أيام واكتشف الفرق بنفسك.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={onStartTrialClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Sparkles size={18} className="shrink-0" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-bold text-white bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <MessageCircle size={18} className="text-emerald-400 shrink-0" />
              <span>محادثة واتساب مباشرة</span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================
          8. FOOTER (التذييل مع رقم الاتصال +201014889704)
         ======================================================== */}
      <footer id="contact" className="bg-slate-950 border-t border-white/10 pt-16 pb-12 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-900">
            {/* Col 1 & 2: Brand Info */}
            <div className="lg:col-span-2 space-y-4 text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Scissors size={20} className="transform -rotate-12" />
                </div>
                <span className="text-xl font-black text-white">سمارت كت برو</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm font-medium">
                منظومة سحابية متخصصة ومصممة بأعلى معايير الدقة لخدمة صالونات الحلاقة، مراكز التجميل، مشاغل الخياطة النسائية، والمراكز الصحية (السبا).
              </p>
              <div className="pt-2 flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>بيانات مشفرة وسيرفرات سحابية آمنة</span>
                </div>
              </div>
            </div>

            {/* Col 3: Quick Navigation */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-white">روابط سريعة</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    الرئيسية
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    مزايا البرنامج
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    الأسعار وباقات الاشتراك
                  </button>
                </li>
                <li>
                  <button
                    onClick={onLoginClick}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </li>
                <li>
                  <button
                    onClick={onStartTrialClick}
                    className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer"
                  >
                    إنشاء حساب تجريبي 7 أيام
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Solutions */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-white">حلول المنظومة</h4>
              <ul className="space-y-2 text-xs font-medium text-slate-400">
                <li>نقاط البيع السريعة والكاشير</li>
                <li>تنظيم المواعيد والحجوزات</li>
                <li>رواتب وعمولات الموظفين</li>
                <li>مستودع وخامات الصالون</li>
                <li>شاشات النداء وكيوسك الحجز</li>
                <li>بوابة خبيرات الميكب آرتست</li>
              </ul>
            </div>

            {/* Col 5: Contact Info (المطلوب: رقم الاتصال +201014889704) */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-white">الاتصال والمبيعات</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                فريقنا جاهز للرد على استفساراتكم والمساعدة في بدء تشغيل المنظومة بصالونكم:
              </p>
              
              <div className="space-y-2 pt-1">
                {/* Phone Call Button */}
                <a
                  href={`tel:${contactPhone}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition-all group"
                  dir="ltr"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Phone size={15} />
                  </div>
                  <span className="font-mono font-bold text-xs">{contactPhone}</span>
                </a>

                {/* WhatsApp Chat Button */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 transition-all group"
                  dir="ltr"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle size={15} />
                  </div>
                  <span className="font-bold text-xs">واتساب: {contactPhone}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
            <p>
              جميع الحقوق محفوظة © {new Date().getFullYear()} سمارت كت برو (Smart Cut Pro) - نظام إدارة صالونات التجميل.
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1.5">
                <Headphones size={14} className="text-emerald-400" />
                <span>دعم فني مباشر: {contactPhone}</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
